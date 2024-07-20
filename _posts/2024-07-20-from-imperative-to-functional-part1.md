---
layout: post
title: "From Imperative Java -> Functional Part 1"
tags: [ Java, Spring Boot, Functional Programming ]
featured_image_thumbnail: assets/images/posts/functional/imperative-to-functional_thumbnail.png
featured_image: assets/images/posts/functional/imperative-to-functional.png
featured: true
---

In this series of articles, we will explore functional programming principles and apply them to transform a RESTful platform written in Java and Spring Boot using FP concepts and structures.

The goal of this series is to demonstrate how to develop Java applications in a functional manner to achieve type safety, immutability, expressiveness, and readability while remaining pragmatic.

In each part, we will learn something new from the functional programming world, demonstrate how to implement it, and apply it to parts of our imperative codebase. Each article will include resources for further learning at the end.

<!--more-->

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url 2024-07-11-what-is-functional-programming %})

## Use case

Our series will focus on transforming a Java platform for users uploading a black-and-white photo to get it colorized. The platform consists of:

1. CRUD APIs for uploading and downloading photos.
2. User registration and authentication.
3. Integration with Amazon Rekognition for filtering out explicit content.
4. Integration with Replicate models for colorization.
5. Integration with S3 for storing photos and colorized photos.
6. Integration with Stripe for purchasing credits for each photo upload and processing.
7. Integration with PostgreSQL database for storing users, payments, and metadata.

The platform has been developed using JDK 21 and the Spring Boot framework with Hibernate. 
It currently lacks sufficient tests to cover the functional requirements, making safe changes to the codebase challenging.

## Goals

Our goals are to:

1. Retain the business logic.
2. Transform the imperative codebase to a functional one by:
   * Introducing immutability in almost all parts of the codebase.
   * Making heavy use of types to express states in our code, such as errors.
   * Avoiding throwing exceptions and utilizing specific FP constructs called Monads to achieve type safety, expressiveness, and self-documenting methods.
   * Using Algebraic Data Types (ADTs, e.g., sealed interfaces in JDK 21).
3. Structuring our code so that the core domain is free of external frameworks, resembling an onion architecture (but not exactly).
4. Being able to utilize Functional Programming pragmatically and knowing when it is really needed.

## Conclusion

In the next article, we will take a deep look into the current state of our platform, introduce basic functional programming terms, 
and create a step-by-step monad called `Either`.
