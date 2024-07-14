---
layout: post
title:  "Monad Transformer in Java for handling Asynchronous Operations and errors (Part 1)"
tags: [ Java, Functional Programming ]
featured_image_thumbnail: assets/images/posts/functional/monad-transformer_thumbnail.jpg
featured_image: assets/images/posts/functional/monad-transformer.jpg
---

During software engineering there is often a need to handle tasks that run in the background and might fail. 
Using `CompletableFuture` helps with running tasks asynchronously, and Try from the [FunctionalUtils](https://github.com/VassilisSoum/FunctionalUtils) library helps manage errors in 
a functional way. But combining these can make the code complex. 
This article introduces [TryT](https://github.com/VassilisSoum/FunctionalUtils/blob/master/src/main/java/com/soumakis/TryT.java), a special tool that wraps Try inside CompletableFuture. 
This makes it easier to handle both asynchronous tasks and errors together.

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url 2024-07-11-what-is-functional-programming %})

<!--more-->

## What is a Monad Transformer?

A monad transformer combines two monads, allowing you to work with both at the same time without getting confused. 
If you have a CompletableFuture for asynchronous tasks and a Try for handling errors, 
a monad transformer like TryT wraps them together so you can manage both effects more easily.

## What is TryT?

[TryT](https://github.com/VassilisSoum/FunctionalUtils/blob/master/src/main/java/com/soumakis/TryT.java) is a tool that combines `Try` and `CompletableFuture`. 
It helps you handle tasks that run in the background and might fail. 
It makes it simpler to chain these tasks and manage errors in a clean way. 
The name follows the naming conventions used by functional libraries in regards with monad transformers by adding a T suffix.

## Why Use TryT?

Directly working with `CompletableFuture<Try<T>>` can make your code complex and hard to read. TryT simplifies this by:

1. Combining Error and Async Handling: It handles both errors and asynchronous tasks together.
2. Cleaner Code: Makes your code easier to read and maintain.
3. Easier to Chain Tasks: Helps you chain tasks without writing a lot of extra code.

## Examples

1. Using `CompletableFuture<Try<T>>` directly:
<pre><code class="language-java">
CompletableFuture&lt;Try&lt;String&gt;&gt; futureTry = someAsyncOperation();

CompletableFuture&lt;Try&lt;Integer&gt;&gt; result = futureTry.thenApply(tryValue -> {
    return tryValue.map(String::length);
});

</code></pre>

Whereas with TryT:

<pre><code class="language-java">
TryT.fromFuture(someAsyncOperation())
    .map(String::length)
</code></pre>

2. Chaining Asynchronous Operations 

<pre><code class="language-java">
CompletableFuture&lt;Try&lt;String&gt;&gt; futureTry = someAsyncOperation();

CompletableFuture&lt;Try&lt;Integer&gt;&gt; result = futureTry.thenCompose(tryValue -> {
    if (tryValue.isSuccess()) {
        return someOtherAsyncOperation(tryValue.get())
            .thenApply(Try::success)
            .exceptionally(Try::failure);
    } else {
        return CompletableFuture.completedFuture(Try.failure(tryValue.getCause()));
    }
});
</code></pre>

Whereas with TryT:

<pre><code class="language-java">
TryT.fromFuture(someAsyncOperation())
    .flatMap(value -> TryT.fromFuture(someOtherAsyncOperation(value)));
</code></pre>

3. Error recovery

<pre><code class="language-java">
CompletableFuture&lt;Try&lt;String&gt;&gt; futureTry = someAsyncOperation();

CompletableFuture&lt;Try&lt;String&gt;&gt; recovered = futureTry.thenApply(tryValue -> {
    return tryValue.recover(ex -> "Fallback value");
});
</code></pre>

Whereas with TryT:

<pre><code class="language-java">
TryT&lt;String&gt; tryT = TryT.fromFuture(someAsyncOperation());

TryT&lt;String&gt; recovered = tryT.recover(ex -> "Fallback value");

</code></pre>

## Conclusion

The [TryT](https://github.com/VassilisSoum/FunctionalUtils/blob/master/src/main/java/com/soumakis/TryT.java) monad transformer 
helps you manage asynchronous tasks and errors together in a simpler way. 
By combining Try with CompletableFuture, TryT provides a clean and functional approach to handle both errors and asychronous tasks. 
This makes your code easier to read and maintain.
