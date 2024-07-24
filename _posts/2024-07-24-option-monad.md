---
layout: post
tags: [ Functional Programming, Java ]
title: "Implementing an Option Monad in Java"
featured_image_thumbnail: assets/images/posts/functional/option_thumbnail.jpg
featured_image: assets/images/posts/functional/option.jpg
---

In this article we are going to explain what is the Option monad, its purpose, why it is a real enhancement over the JDK
Optional, and how to implement it from scratch.

<!--more-->

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url
2024-07-11-what-is-functional-programming %})

For other very useful monads and functional programming utilities you can checkout this library of
mine [here](https://github.com/VassilisSoum/FunctionalUtils)

## Introduction

### What is an Option monad

An Option monad is a type that represents the presence or absence of a value. It can be used to avoid null pointer
exceptions
and to make the code more readable and maintainable. It also enjoys the benefits of immutability and chaining
computations inherent in monads.

### Why is it a real enhancement over the JDK Optional

It is a real enhancement over the JDK Optional
class because it provides the following benefits:

1. **Avoids NoSuchElementException**: The Option monad defines an ADT with two cases: `Some` and `None`. This makes it
   impossible to
   access a value that is not present because there is not `get` method in the Option interface at all.
2. **Avoid NullPointerException**: The Option monad handles the null by
   instantiating an instance of None.
3. **Support for Pattern Matching**: Since the Option monad is an ADT, it can be pattern matched. This allows for
   more expressive and readable code.

Whereas the JDK Optional class lacks these features as it erroneously results in:

1. `Optional.of` throws NullPointerException if the provided value is null. This defeats the purpose of having an
   Optional to handle potentially null values gracefully. It forces the developer to handle nulls before calling `of` or
   worse using `ofNullable` everywhere.
2. `get` on an empty Optional throws NoSuchElementException if the Optional is empty. This encourages a pattern where
   the developer must always check if the Optional is present before calling `get`, leading to something that is not
   safer than checking for nulls directly.

### Implementation

Before proceeding with the implementation, we need to outline our goals. Our Option monad should achieve the following:

1. **Immutability**: Every operation should be immutable.
2. **Transformation and Chaining**: Provide `map` and `flatMap` methods to transform and chain computations in a
   functional programming style.
3. **Pattern Matching**: Model the Option as an ADT with two cases: Some and None.
4. **Avoid NullPointerException**: Handle the null case by instantiating an instance of None.
5. **Avoid NoSuchElementException**: Do not provide a get method in the Option interface.
6. **Thread Safety**: Every operation in the Option monad should be thread-safe.

Let's first define the `Some` and `None` classes:

```java
public record Some<T>(T value) implements Option<T> {

}

public record None<T>() implements Option<T> {

}

```

The Option interface is defined as follows:

```java
public sealed interface Option<T> permits Some, None {

  /**
   * Returns an {@code Option} instance that wraps the given value. If the value is {@code null}
   * then an instance of {@link None} is returned.
   *
   * @param value the value to wrap
   * @param <T>   the type of the value
   * @return an {@code Option} instance
   */
  static <T> Option<T> of(T value) {
    return value == null ? new None<>() : new Some<>(value);
  }

  /**
   * Returns a {@code None} instance.
   *
   * @param <T> the type of the value
   * @return a {@code None} instance
   */
  static <T> Option<T> none() {
    return new None<>();
  }

  /**
   * Returns the value if it exists, otherwise returns the given default value.
   *
   * @param defaultValue the default value to return if the value does not exist
   * @return the value if it exists, otherwise the default value
   */
  default T getOrElse(T defaultValue) {
    return switch (this) {
      case Some<T> some -> some.value();
      case None<T> ignored -> defaultValue;
    };
  }

  /**
   * Returns whether the value exists.
   *
   * @return {@code true} if the value does not exist, otherwise {@code false}
   */
  default boolean isEmpty() {
    return this instanceof None;
  }

  /**
   * Returns whether the value exists.
   *
   * @return {@code true} if the value exists, otherwise {@code false}
   */
  default boolean isDefined() {
    return this instanceof Some;
  }

  /**
   * Applies the given predicate to the value if it the instance is a {@link Some} and returns a the
   * instance of {@link Some} if the predicate is satisfied, otherwise returns an instance of
   * {@link None}.
   *
   * @param predicate the predicate to apply to the value
   * @return an {@code Option} instance
   */
  default Option<T> filter(Predicate<T> predicate) {
    return switch (this) {
      case Some<T> some -> predicate.test(some.value()) ? this : new None<>();
      case None<T> ignored -> this;
    };
  }

  /**
   * Applies the first function if the instance is a {@link None} and the second function if the
   * instance is a {@link Some}.
   *
   * @param notFoundFunction the function to apply if the instance is a {@link None}
   * @param foundFunction    the function to apply if the instance is a {@link Some}
   * @param <U>              the type of the result
   * @return the result of the applied function
   */
  default <U> U fold(Supplier<U> notFoundFunction,
      Function<? super T, ? extends U> foundFunction) {
    Objects.requireNonNull(notFoundFunction);
    Objects.requireNonNull(foundFunction);
    return switch (this) {
      case Some<T> some -> foundFunction.apply(some.value());
      case None<T> ignored -> notFoundFunction.get();
    };
  }

  /**
   * Maps the value to a new value using the given function if the instance is a {@link Some},
   * otherwise returns an instance of {@link None}.
   *
   * @param fn  the function to apply to the value
   * @param <U> the type of the new value
   * @return an {@code Option} instance
   */
  default <U> Option<U> map(Function<? super T, ? extends U> fn) {
    Objects.requireNonNull(fn);
    return switch (this) {
      case Some<T> some -> Option.of(fn.apply(some.value()));
      case None<T> ignored -> Option.none();
    };
  }

  /**
   * Flat Maps the value to a new value using the given function if the instance is a {@link Some},
   * otherwise returns an instance of {@link None}.
   *
   * @param fn  the function to apply to the value
   * @param <U> the type of the new value
   * @return an {@code Option} instance
   */
  default <U> Option<U> flatMap(Function<? super T, ? extends Option<U>> fn) {
    Objects.requireNonNull(fn);
    return switch (this) {
      case Some<T> some -> fn.apply(some.value());
      case None<T> ignored -> Option.none();
    };
  }

  /**
   * Returns an instance of {@link Right} if the instance is a {@link Some}, otherwise returns an
   * instance of {@link Left}.
   *
   * @param supplier the supplier to provide the value for the left side
   * @param <X>      the type of the left side
   * @return an instance of {@link Either}
   */
  default <X> Either<X, T> toRight(Supplier<X> supplier) {
    Objects.requireNonNull(supplier);
    return switch (this) {
      case Some<T> some -> Either.right(some.value());
      case None<T> ignored -> Either.left(supplier.get());
    };
  }

  /**
   * Returns an instance of {@link Left} if the instance is a {@link Some}, otherwise returns an
   * instance of {@link Right}.
   *
   * @param supplier the supplier to provide the value for the right side
   * @param <X>      the type of the right side
   * @return an instance of {@link Either}
   */
  default <X> Either<T, X> toLeft(Supplier<X> supplier) {
    Objects.requireNonNull(supplier);
    return switch (this) {
      case Some<T> some -> Either.left(some.value());
      case None<T> ignored -> Either.right(supplier.get());
    };
  }

  /**
   * Returns a {@link Try} instance that wraps the value if the instance is a {@link Some},
   * otherwise returns a {@link Try} instance that wraps the exception provided by the supplier.
   *
   * @param exceptionSupplier the supplier to provide the exception
   * @return a {@link Try} instance
   */
  default Try<T> toTry(Supplier<Exception> exceptionSupplier) {
    Objects.requireNonNull(exceptionSupplier);
    return switch (this) {
      case Some<T> some -> Try.success(some.value());
      case None<T> ignored -> Try.failure(exceptionSupplier.get());
    };
  }

  /**
   * Returns an {@link Optional} instance that wraps the value if the instance is a {@link Some},
   * otherwise returns an empty {@link Optional}.
   *
   * @return an {@link Optional} instance
   */
  default Optional<T> toJavaOptional() {
    return switch (this) {
      case Some<T> some -> Optional.of(some.value());
      case None<T> ignored -> Optional.empty();
    };
  }

  /**
   * Returns the original Option if it is a {@link Some}, otherwise returns the Option provided by
   * the supplier.
   *
   * @param supplier the supplier to provide the Option
   * @return an {@code Option} instance
   */
  @SuppressWarnings("unchecked")
  default Option<T> or(Supplier<? extends Option<? extends T>> supplier) {
    Objects.requireNonNull(supplier);
    return switch (this) {
      case Some<T> ignored -> this;
      case None<T> ignored -> (Option<T>) supplier.get();
    };
  }

}
```

### Examples

```java
Option<String> some = Option.of("Hello");
Option<String> none = Option.none();

// map
Option<Integer> length = some.map(String::length);

// flatMap
Option<Integer> length2 = some.flatMap(s -> Option.of(s.length()));

// filter
Option<String> filtered = some.filter(s -> s.length() > 5);

// getOrElse
String value = none.getOrElse("World");

// isEmpty
boolean empty = none.isEmpty(); // should be true

// isDefined
boolean defined = some.isDefined(); // should be true

// fold
String result = some.fold(() -> "Not Found", Function.identity());
String result2 = none.fold(() -> "Not Found", Function.identity()); // should be "Not Found"

// toRight
Either<String, String> right = some.toRight(() -> "Something went wrong"); // should be Right("Hello")
Either<String, String> left = none.toRight(() -> "Something went wrong"); // should be Left("Something went wrong")

// toLeft
Either<String, String> left2 = some.toLeft(() -> "Something went wrong"); // should be Left("Hello")
Either<String, String> right2 = none.toLeft(() -> "Something went wrong"); // should be Right("Something went wrong")

// toTry
Try<String> success = some.toTry(() -> new Exception("Something went wrong")); // should be Success("Hello")
Try<String> failure = none.toTry(() -> new Exception("Something went wrong")); // should be Failure(Exception("Something went wrong"))

// toJavaOptional
Optional<String> optional = some.toJavaOptional(); // should be Optional("Hello")
Optional<String> emptyOptional = none.toJavaOptional(); // should be Optional.empty()

// or
Option<String> or = none.or(() -> Option.of("World")); // should be Some("World")
```

## Conclusion

In this article, we have implemented an Option monad from scratch in Java. We have seen how the Option monad can be used
to avoid null pointer exceptions and make the code more readable and maintainable. We have also discussed the benefits
of
the Option monad over the JDK Optional class and outlined the goals of our implementation. Finally, we have provided
examples of how to use the Option monad in practice.
