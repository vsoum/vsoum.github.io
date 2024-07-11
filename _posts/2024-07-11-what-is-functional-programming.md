---
layout: post
tags: [ Functional Programming ]
title: "An informal definition of Functional Programming"
featured_image_thumbnail: assets/images/posts/functional/fp_thumbnail.png
featured_image: assets/images/posts/functional/fp.png
---

In this article we will try to provide an informal definition of functional programming and explain some basic terms.

<!--more-->

Functional Programming (FP) is a programming paradigm focusing on using functions, immutability and function composition to build programs.
It aims to enhance code readability, maintainability and predictability by avoiding as much as possible side-effects and instead using pure functions.
FP provides a declarative approach by describing what the outcome should be (the "what") rather than detailing the steps to achieve it (the "how).

Phew a lot of terms of the above. Let's break it down one by one.

### What is immutability

In programming, immutability is the process of not modifying the state of a data structure (such as string, array, object) but instead 
create copies with modified state as part of a computation without altering the original data structure. 

### What is a function

A function is a block of code that accepts inputs and produces outputs. For example consider a block of code that accepts 
two numbers and produces an addition of those two. 

```
add(a: Int, b: Int): Int = a + b
```

### Basic types of functions 
In Functional Programming functions can be added into two major categories: Pure and impure. 

A `Pure` function is a function that given the exact same inputs it will produce the same output. In the previous example 
if the same `a, b` are passed as inputs to the function then the result will be the same always. Pure functions have several 
advantages such as:
1. Easier to reason about and debug.
2. No state modification.
3. Inherently thread safe.
4. Referentially transparent. This term is especially important because it allows functions to be replaced with the value they produce. For example, in the previous example wherever we use the `add` function with the same inputs we can use the result of it safely.

In other words, a Pure function is one that does not produce any side effects.

An `Impure` function is a function that given the exact same inputs it is not guaranteed that it will produce the same output. Normally 
impure functions are producing a side effect such as logging, saving to a datastore, calling an api or modifying internal state.

Although Functional Programming has its definition around pure functions, we need to admit that no useful program can be written without 
impure functions. However, the concept of Functional Programming is to model the impure functions in a way so they can be combined 
with pure functions while retaining on describing the "what". To achieve it the structure `Monad` is used.

### What is Monad

There are multiple formal and informal definitions of what is monad. One of them is:

A monad is a pattern used in functional programming that helps manage computations and data transformations. 
Think of it as a wrapper around a value or a task that provides a structured way to handle operations on that value.

For example, in Java, Optional is a monad. It wraps a value that might or might not be there and provides methods like map to transform the value and flatMap to chain operations.

A monad allows chaining operations while managing side effects and computations such as handling null/absent values, managing state or dealing with I/O.

#### Key concepts of Monads

1. Encapsulation of Side Effects:
    Monads encapsulate side effects within a controlled context. This allows the rest of the code to remain pure and free from side effects. By containing side effects within the monad, the impurity is localized.
    Example: In Haskell, the IO monad or in Scala with Cats IO encapsulates input/output operations, ensuring that functions remain pure by deferring side effects until the program's execution.

2. Chaining Operations:
    Monads enable chaining of operations (using flatMap) while maintaining the context. This helps in sequencing operations that involve side effects without directly causing those effects in the main logic.
    Example: Using the Option monad in Scala to handle operations that may return None (null values) without having null checks throughout the code.

3. Managing State:
    The State monad manages stateful computations in a pure functional way. It connects state through computations without mutating global state.
    Example: In Haskell, the State monad allows functions to pass state explicitly through their arguments and return values.

Let's also consider an example in Java (from Java 8 and onwards) with the `Optional` class which can be considered a monad since it contains 
both map and flatmap methods as well as a `unit` method.

<pre><code class="language-java">
import java.util.Optional;

public class MonadExample {
    public static void main(String[] args) {
        Optional&lt;String&gt; result = Optional.of("Hello")
                                          .flatMap(s -> Optional.of(s + " World"))
                                          .flatMap(s -> Optional.of(s + "!"));

        result.ifPresent(System.out::println); // Output: Hello World! .
//This is an impure function because it produces a side effect - printing to the console.
    }
}

</code></pre>

### Conclusion

This article attempted to provide an informal definition of Functional Programming. What are its benefits and what it consists of. 

In the next articles we will continue the journey of functional programming principles while demonstrating code written with imperative style.

For more information around Functional Programming you can visit [principles of functional programming](https://www.freecodecamp.org/news/the-principles-of-functional-programming/)


