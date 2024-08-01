---
layout: post
title: "How the JDK Optional breaks the monad laws and why it matters"
tags: [ Java, Functional Programming ]
featured_image_thumbnail: assets/images/posts/functional/monad-laws_thumbnail.png
featured_image: assets/images/posts/functional/monad-laws.png
featured: true
---

In this article, we are going to prove why the JDK Optional fails to respect the Monad Laws and why it matters.

<!--more-->

For a convenient zero-dependencies library allowing you to start using useful functional programming constructs you can
check out the [FunctionalUtils library](https://github.com/VassilisSoum/FunctionalUtils)

## Introduction

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url
2024-07-11-what-is-functional-programming %}).

### What are monad laws?

Monad laws dictate the behavior of a monad in the functional programming world and whether it can be considered a true
one or not. There are three laws, namely:

1. Left Identity
2. Right Identity
3. Associativity

Let's analyze each law:

1. Left identity: The left identity states that given a function 'f' returning a monad
   then `flatMap(unit(value), f) === f(value)`. In other words, considering the Optional from the JDK we can state the
   left identity as 'of(value).flatMap(f) === f(value)'.
2. Right identity: The right identity states the given a function 'f' returning a monad and 'm' being an instance of a
   monad then `flatMap(m, unit) === m`. In other words, considering the Optional from the JDK we can state the right
   identity as 'm.flatMap(Optional::of) === m'.
3. Associativity: If we have a chain of monadic function applications, it does not matter how they are nested. It can
   be represented as `flatMap(flatMap(m, f), g) === flatMap(m, x -> g(f(x)))` where 'm' is an instance of a monad, 'f' a
   function that returns a monad and 'g' another function as well. In other
   words, considering again the Optional from the JDK we can state the associativity
   as:  'm.flatMap(f).flatMap(g) === m.flatMap(x -> f.apply(x).flatMap(g))'

### Why they matter

1. Monad laws ensure that the composition of monadic functions behaves predictably. This predictability simplifies
   reasoning about code and makes refactoring safer.
2. By adhering to monad laws, developers can create more maintainable code. Functions and monadic chains can be
   rearranged and refactored without unexpected side effects, leading to clearer and more modular code.

## How JDK Optional breaks the monad laws

Let's see an example for each monad law and try to figure out if Optional respects it.

#### Left identity

Consider a function 'f' that given an Integer returns an Optional<Integer> based on some business logic.

```java
Function<Integer, Optional<Integer>> f = x -> {
    if (x == null) {
        x = -1;
    } else if (x == 2) {
        x = null;
    } else {
        x = x + 1;
    }
    return Optional.ofNullable(x);
};

```

1. Optional.of(1).flatMap(f).equals(f.apply(1)) // This is true which means Optional[2] === Optional[2]
2. Optional.of(2).flatMap(f).equals(f.apply(2)); // This is also true which means Optional.empty === Optional.empty
3. Optional.ofNullable((Integer) null).flatMap(f).equals(f.apply(null)); // This is false because the left hand side
   results in Optional.empty and the right side results in Optional[1] breaking the **left identity law**.

#### Right identity

```java

Optional<Integer> opt = Optional.of(1);

opt.flatMap(Optional::of); // This should be equivalent to opt

Optional<Integer> opt2 = Optional.empty();

opt2.flatMap(Optional::of); // This should be equivalent to opt2 which is empty.

```

The right identity law holds as we can see.

#### Associativity

Let's consider two basic functions:

```java
Function<Integer, Option<Integer>> f = x -> Option.of(x + 1);
Function<Integer, Option<Integer>> g = x -> Option.of(x * 2);
```

And the application of these two functions

```java
Optional<Integer> opt = Optional.of(1);
Optional<Integer> result1 = opt.flatMap(f).flatMap(g);
Optional<Integer> result2 = opt.flatMap(x -> f.apply(x).flatMap(g));
```

**Left Side: opt.flatMap(f).flatMap(g)**

* opt.flatMap(f):
    - opt is Optional.of(1).
    - Applying f to 1 results in Optional.of(2).

* Optional.of(2).flatMap(g):
    - Applying g to 2 results in Optional.of(4).

So, result1 is Optional.of(4).

**Right Side: opt.flatMap(x -> f.apply(x).flatMap(g))**

* opt.flatMap(x -> f.apply(x).flatMap(g)):
    - opt is Optional.of(1).
* Applying x -> f.apply(x).flatMap(g) to 1:
    - f.apply(1) results in Optional.of(2).
    - Applying g to 2 results in Optional.of(4).

So results1 == result2 thus **Associativity ** is respected.

However, sadly this is not always the case. Let's explore another more real-world scenario.

### Example scenario where associativity is broken

1. Fetching user data from a database.
2. Process the data
3. Format the data

```java
record User(int id, String name) {}

static Function<Integer, Optional<User>> fetchUser = id -> {
    if (id == 1) {
        return Optional.of(new User(1, "John"));
    } else {
        return Optional.empty();
    }
};

static Function<User, Integer> fetchBalance = user -> user.id() == 1 ? null : 100;

static Function<Integer, String> formatBalance = balance -> {
    if (balance == null) {
        return "No Balance";
    } else {
        return "Balance: " + balance;
    }
};

```

We have defined three functions that represent the three steps of our scenario.

1. fetchUser: Given an id it returns the user data.
2. fetchBalance: Given the user data, it returns the balance.
3. formatBalance: Given the balance, it returns a formatted string.

Although the example might seem trivial, it is easy to imagine that the `fetchBalance` and `formatBalance` could be more
complex involving a lot of more business logic and potentially being outside our control such as in libraries and
potentially being a legacy code.

Let's see how the associativity law is broken in this case.

The original code we have in our code and we want to refactor is the following:

```java
String result = fetchUser.apply(1)
      .map(fetchBalance.andThen(formatBalance))
      .orElse("Processing could not be completed");

System.out.println(result);

```

**fetchUser.apply(1).map(fetchBalance.andThen(formatBalance))** is a composition of two functions inside a map function.

- fetchUser.apply(1) returns Optional[User(1, "John")]
- fetchBalance is applied to the User(1, "John") and returns null
- formatBalance is applied to null passed from fetchBalance and returns "No Balance"
- The message displayed is "No Balance"

We are tasked of refactoring the above code to be composed of a series of monadic function applications like:

```java
String result = fetchUser.apply(1)
      .map(fetchBalance)
      .map(formatBalance)
      .orElse("Processing could not be completed");

System.out.println(result);

```

**fetchUser.apply(1).map(fetchBalance).map(formatBalance)** is a series of monadic function applications.

- fetchUser.apply(1) returns Optional[User(1, "John")]
- map(fetchBalance) returns Optional[null] which is translated to Optional.empty
- No further processing is done as the Optional is empty and the message displayed is "Processing could not be
  completed".

Sadly, **the associativity law is broken in this case**. The refactored code does not behave the same as the original
code
thus introducing subtle bugs and making the code harder to debug. If we don't have enough test coverage, we might not
even notice the bug until the runtime.

## What we can do about it

There are few options when it comes to the JDK Optional. We can either:

1. **Use a different library**: There are many libraries out there that provide a more robust implementation of the
   Optional monad. For example, the Vavr library provides an `Option` type that respects the monad laws. However, it is
   not maintained anymore. Another option is to use the FunctionalUtils library which provides a more robust and tested
   implementation of the Optional monad.
2. **Implement your own Optional**: Take a look at how to implement [Your own Option monad upholding all laws]({{
   site.baseurl }}{% post_url
   2024-07-24-option-monad %}). It is straightforward to implement your own Option monad that respects the monad laws
   and additionally maintain full compatibility with the JDK Optional.
3. **Use the Optional with caution**: If you are aware of the limitations of the JDK Optional and the potential issues
   it can cause, you can still use it but with caution. Make sure to thoroughly test your code and be aware of the
   potential pitfalls.

## References

- https://www.sitepoint.com/how-optional-breaks-the-monad-laws-and-why-it-matters/






