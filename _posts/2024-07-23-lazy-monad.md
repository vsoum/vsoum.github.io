---
layout: post
tags: [ Functional Programming, Java ]
title: "Implementing a Lazy Monad in Java"
featured_image_thumbnail: assets/images/posts/functional/lazy_thumbnail.jpeg
featured_image: assets/images/posts/functional/lazy.jpeg
---

In this article we are going to explain what is a Lazy monad, its purpose and use cases and implement it from scratch.

<!--more-->

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url
2024-07-11-what-is-functional-programming %})

For other very useful monads and functional programming utilities you can checkout this library of mine [here](https://github.com/VassilisSoum/FunctionalUtils)

## Introduction

### What is a Lazy monad

A lazy monad allows us to defer the execution of computations. With this monad, we enjoy all the benefits of chaining
computations and immutability inherent in monads, with the added benefit that the computations are performed lazily and
only when needed.

### Difference between JDK Supplier and Lazy monad

Some striking differences between the monad we will be implementing versus the JDK `Supplier` functional interface are:

**Supplier**

1. Supports laziness by deferring the execution of the wrapped computation until the method `get` is called.
2. Does not support memoization, which means it does not cache the value once computed. This can lead to several issues in a multithreading application if not handled correctly:
    * Expensive resources being acquired repeatedly.
    * Computations meant to run once being executed multiple times.
    * Potentially incorrect application state.
    * The responsibility falls to the developer to ensure these issues do not occur.

**Lazy monad**

1. Supports laziness by deferring the execution of the wrapped computation until the method `get` is called.
2. Supports memoization. Upon the first call of the get method, the result of the wrapped computation is stored in memory. Further calls to get will always return the memoized value.
3. As a monad, it implements the methods `map` for applying a function to the type of the wrapped computation and `flatMap` to chain multiple computations involving the Lazy monad together.
4. The added benefit of map and flatMap is that they are lazy until `get` is called.
5. Every operation in the Lazy monad is immutable, which ensures thread safety and correctness in concurrent applications.

### Implementation

Before proceeding with the implementation, we need to outline our goals. Our Lazy monad should achieve the following:

1. Laziness: Every operation, except for `get`, should defer the computation.
2. Transformation and Chaining: Provide `map` and `flatMap` methods to transform and chain computations in a functional programming style.
3. Memoization: Implement a get method that evaluates the computation once and memoizes the result.

Let's proceed with the implementation:

```java
public final class Lazy<T> {

  // Using a sentinel value to represent uninitialized state because null is a valid value.
  private static final Object UNINITIALIZED = new Object();

  private final Supplier<T> lazyValue;
  private final Object lock = new Object();
  private volatile Object evaluatedValue = UNINITIALIZED;

  private Lazy(Supplier<T> lazyValue) {
    this.lazyValue = lazyValue;
  }

  private Lazy(T value) {
    this.lazyValue = () -> value;
    this.evaluatedValue = value;
  }

  /**
   * Creates a new lazy value.
   *
   * @param supplier the supplier that provides the value
   * @param <T>      the type of the value
   * @return a new lazy value
   * @throws NullPointerException if the supplier is null
   */
  public static <T> Lazy<T> of(Supplier<T> supplier) {
    return new Lazy<>(Objects.requireNonNull(supplier));
  }

  /**
   * Creates a new lazy value with an already evaluated value. Useful when you want to memoize a
   * value that is already computed.
   *
   * @param value the value
   * @param <T>   the type of the value
   * @return a new lazy value
   */
  public static <T> Lazy<T> evaluated(T value) {
    return new Lazy<>(value);
  }

  /**
   * Gets the value. If the value has not been evaluated yet, it evaluates it and caches it.
   *
   * @return the value
   */
  @SuppressWarnings("unchecked")
  public T get() {
    Object value = evaluatedValue;
    if (value == UNINITIALIZED) {
      synchronized (lock) {
        value = evaluatedValue;
        if (value == UNINITIALIZED) {
          value = lazyValue.get();
          evaluatedValue = value;
        }
      }
    }
    return (T) value;
  }

  /**
   * Maps the value of this lazy instance to a new value.
   *
   * @param mapper the mapping function
   * @param <R>    the new type of the value
   * @return a new lazy instance with the mapped value
   */
  public <R> Lazy<R> map(Function<? super T, ? extends R> mapper) {
    return Lazy.of(() -> mapper.apply(this.get()));
  }

  /**
   * Flat maps the value of this lazy instance to a new lazy instance.
   * <b>It is susceptible to stack overflow if the function passed to it is not tail recursive.</b>
   *
   * @param mapper the mapping function
   * @param <R>    the new type of the value
   * @return a new lazy instance with the mapped value
   * @throws StackOverflowError if the function passed to it is not tail recursive
   */
  public <R> Lazy<R> flatMap(Function<? super T, Lazy<R>> mapper) {
    return Lazy.of(() -> mapper.apply(this.get()).get());
  }

}
```

Notes and considerations:

* Deferred Computation:
  - We have defined a method of which accepts a `Supplier` that wraps a deferred computation.

* Memoization and Volatile Storage:
  - We will store the evaluated computation in a volatile Object instance. Initially, this field is initialized with a sentinel value indicating that the computation has not been executed yet.
  - The sentinel value also distinguishes cases where the computation returns null, which is a perfectly acceptable result.

* Maintaining Laziness with map and flatMap:
  - The methods `map` and `flatMap` retain the laziness of the computation by wrapping the initial Supplier in another Supplier.
  - Care should be taken to avoid excessive recursion in flatMap operations, as this could lead to a stack overflow error.

* Thread-Safe Evaluation with get:
  - The `get` method uses a double-checked locking idiom to ensure that even if accessed by multiple threads before initialization, the computation is evaluated only once.

### Examples

* Defining a variable that when called will execute the expensive computation.

```java 
private final Lazy<Integer> lazy = Lazy.of(this::veryExpensiveComputation);

//complex statements here

return lazy.get(); //Finally execute the computation.
```

* Chaining operations in a functional programming style.

```java
Lazy.of(this::expensiveComputation)
  .map(value -> transformValueToValue2(value))
  .flatMap(value2 -> anotherExpensiveComputationReturningLazyAsReturnType)
  .get();

```

* Ensuring that multiple threads can call the get method without recomputing the value.

```java
Lazy<Integer> lazy = Lazy.of(this::veryExpensiveComputation);

ExecutorService executor = Executors.newFixedThreadPool(10);
executor.invokeAll(Collections.nCopies(10, () -> new Callable<Integer>() {
  @Override
  public Integer call() throws Exception {
    return lazy.get(); //All threads will get the same value without recomputation.
  }
}));
```

* Combining other monads inside

```java
Lazy<Either<Exception, Integer>> lazy = Lazy.of(() -> {
  try {
    return Either.right(veryExpensiveComputation());
  } catch (Exception e) {
    return Either.left(e);
  }
});
```

### Conclusion

In this article, we have implemented a Lazy monad from scratch in Java. 
We have discussed the purpose of a Lazy monad, its use cases, and the differences between the JDK `Supplier` 
functional interface and our implementation. We have also outlined the goals of our implementation and provided examples 
of how to use the Lazy monad in practice.
