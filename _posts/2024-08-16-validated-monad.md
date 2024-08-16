---
layout: post
title: "Implementing a Validated Monad in Java and using it with Spring Boot"
tags: [ Java, Spring Boot, Functional Programming ]
featured_image_thumbnail: assets/images/posts/functional/validated_thumbnail.jpg
featured_image: assets/images/posts/functional/validated.jpg
featured: true
---

In this article we will implement a `Validated` monad in Java, explain its use cases and how it can be used with Spring
Boot and any other Java framework.

<!--more-->

For a convenient zero-dependencies library allowing you to start using useful functional programming constructs you can
check out the [FunctionalUtils library](https://github.com/VassilisSoum/FunctionalUtils)

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url
2024-07-11-what-is-functional-programming %}).

## Introduction

In functional programming, a monad is a design pattern that allows you to chain operations together in a way that is
composable and more fluent to read. A Validated monad is a monad that allows you to chain operations together, but it
also
accumulates errors that occur during the operations. This is useful when you want to validate multiple things at once
and return all the errors that occurred.

## Implementing the Validated Monad

We will start by implementing the Validated monad. We will create a sealed interface Validated that will have two
subclasses,
`Valid` and `Invalid`. The Valid class will hold a value and the Invalid class will hold a list of errors.

To respect the properties of a monad, we will implement the `unit` and `bind` methods written as `of` and `flatMap`
respectively.
Additionally, we will implement a `map` method that will allow us to apply a function to the value of the Valid class
as well as a `mapN` method that will allow us to combine multiple Validated instances and accumulate the errors.

```java
public sealed interface Validated<E, A> permits Valid, Invalid {

  /**
   * Create a new Valid instance.
   *
   * @param value The value to wrap
   * @param <E>   The type of the error
   * @param <A>   The type of the value
   * @return A new Valid instance
   */
  static <E, A> Validated<E, A> valid(A value) {
    return new Valid<>(value);
  }

  /**
   * Create a new Invalid instance.
   *
   * @param error The error to wrap
   * @param <E>   The type of the error
   * @param <A>   The type of the value
   * @return A new Invalid instance
   */
  static <E, A> Validated<E, A> invalid(E error) {
    return new Invalid<>(error);
  }

  /**
   * Combines two or more {@code Validated} instances into a single instance. If all instances are
   * valid, the result is a valid instance with a list of values. If any instance is invalid, the
   * result is an invalid instance with a list of errors.
   *
   * @param validatedList a list of {@code Validated} instances
   * @param fn            a function that takes a list of values and returns a new value
   * @param <E>           the type of the error
   * @param <B>           the new type of the value
   * @return a new {@code Validated} instance
   */
  @SuppressWarnings("unchecked")
  static <E, B> Validated<List<E>, B> mapN(
      Function<List<Object>, B> fn, List<Validated<E, ?>> validatedList) {
    List<Object> values = new ArrayList<>();
    List<E> errors = new ArrayList<>();

    for (Validated<E, ?> validated : validatedList) {
      if (validated instanceof Valid) {
        values.add(((Valid<E, ?>) validated).value());
      } else {
        errors.add(((Invalid<E, ?>) validated).error());
      }
    }

    if (errors.isEmpty()) {
      return Validated.valid(fn.apply(values));
    } else {
      return Validated.invalid(errors);
    }
  }

  /**
   * Check if the instance is valid.
   *
   * @return true if the instance is valid, false otherwise
   */
  default boolean isValid() {
    return this instanceof Valid;
  }

  /**
   * Check if the instance is invalid.
   *
   * @return true if the instance is invalid, false otherwise
   */
  default boolean isInvalid() {
    return this instanceof Invalid;
  }

  /**
   * Get the error if the instance is invalid.
   *
   * @return The error
   */
  default E getInvalid() {
    return ((Invalid<E, A>) this).error();
  }

  /**
   * Get the value if the instance is valid.
   *
   * @return The value
   */
  default A getValid() {
    return ((Valid<E, A>) this).value();
  }

  /**
   * Map the value if the instance is valid.
   *
   * @param fn  The function to apply
   * @param <B> The new type of the value
   * @return A new Valid instance with the new value
   */
  default <B> Validated<E, B> map(Function<? super A, ? extends B> fn) {
    if (isInvalid()) {
      return Validated.invalid(getInvalid());
    }
    return Validated.valid(fn.apply(getValid()));
  }

  /**
   * FlatMap the value if the instance is valid.
   *
   * @param fn  The function to apply
   * @param <B> The new type of the error
   * @return A new Valid instance with the new value
   */
  default <B> Validated<E, B> flatMap(Function<? super A, ? extends Validated<E, B>> fn) {
    if (isInvalid()) {
      return Validated.invalid(getInvalid());
    }
    return fn.apply(getValid());
  }

  /**
   * Apply the first function if the instance is invalid, the second function if the instance is
   * valid.
   *
   * @param invalidFn the function to apply if the instance is invalid.
   * @param validFn   the function to apply if the instance is valid.
   * @param <L>       The new type of the error
   * @param <B>       The new type of the value
   * @return the result of applying the appropriate function.
   */
  default <L, B> Validated<L, B> bimap(Function<? super E, ? extends L> invalidFn,
      Function<? super A, ? extends B> validFn) {
    if (isInvalid()) {
      return Validated.invalid(invalidFn.apply(getInvalid()));
    }
    return Validated.valid(validFn.apply(getValid()));
  }

  /**
   * Applies a function to the value inside {@code Validated}, depending on whether the instance is
   * {@code Invalid} or {@code Valid}.
   *
   * @param invalidFn the function to apply if the instance is invalid.
   * @param validFn   the function to apply if the instance is valid.
   * @param <B>       The new type of the value
   * @return the result of applying the appropriate function.
   */
  default <B> B fold(Function<? super E, ? extends B> invalidFn,
      Function<? super A, ? extends B> validFn) {
    if (isInvalid()) {
      return invalidFn.apply(getInvalid());
    }
    return validFn.apply(getValid());
  }

  /**
   * Get the value if the instance is valid, or the other value if the instance is invalid.
   *
   * @param other The value to return if the instance is invalid.
   * @return The value if the instance is valid, or the other value if the instance is invalid.
   */
  default A getOrElse(A other) {
    if (isInvalid()) {
      return other;
    }
    return getValid();
  }

  /**
   * Swaps the sides of this {@code Validated}. If this is {@code Valid}, then the returned instance
   * will be {@code Invalid} with the same value and vice versa.
   *
   * @return A new instance with the value and the error swapped.
   */
  default Validated<A, E> swap() {
    if (isInvalid()) {
      return Validated.valid(getInvalid());
    }
    return Validated.invalid(getValid());
  }

  /**
   * Converts the instance to an {@code Optional}.
   *
   * @return An {@code Optional} instance.
   */
  default Optional<A> toOptional() {
    if (isInvalid()) {
      return Optional.empty();
    }
    return Optional.of(getValid());
  }
}

```

## Example Usage of the Validated Monad

To apply the Validated monad, we will implement a sample Spring Boot application that demonstrates how to use the
Validated monad to validate a form containing some person specific information and accumulate errors.

It consists of a REST endpoint that accepts a JSON payload containing some person identification information and
validates it using the Validated monad. If there are any errors, it returns a 400 response with a JSON payload
containing the errors. If the validation is successful, it returns a 204 response.

### Setting up the Spring Boot Application

Let's declare the dependencies required for the Spring Boot application in the `pom.xml` file.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.soumakis</groupId>
    <artifactId>Validated-Monad-Spring-Rest</artifactId>
    <version>1.0-SNAPSHOT</version>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.2</version>
        <relativePath/> <!-- lookup parent from repository -->
    </parent>

    <properties>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <functional.utils.version>2.2.0</functional.utils.version>
    </properties>

    <dependencies>
        <!-- Other dependencies -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
    </dependencies>

</project>
```

### Implementing the Person DTO

We will start by implementing a DTO class that represents the person information.

```java
package com.soumakis.example.domain;

public record PersonRequest(String name, Integer age, String city, String email, String password) {

}

```

### Implementing the Person Validator

Next, we will implement a class that will validate the person's information using the Validated monad we implemented
earlier.

```java
package com.soumakis.example.domain;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class PersonValidator {

    private static final Set<String> ALLOWED_CITIES = Set.of("New York", "Los Angeles", "Chicago",
        "Houston", "Phoenix", "Athens");
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");
    private static final Pattern PASSWORD_PATTERN = Pattern.compile(
        "^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$");
    private static final Pattern NAME_PATTERN = Pattern.compile("^[A-Za-z ]+$");

    public Validated<String, String> validateName(String name) {
        if (name == null || name.trim().isEmpty()) {
            return Validated.invalid("Name cannot be empty");
        } else if (!NAME_PATTERN.matcher(name).matches()) {
            return Validated.invalid("Name must not contain numbers or special characters");
        } else {
            return Validated.valid(name);
        }
    }

    public Validated<String, Integer> validateAge(Integer age) {
        if (age == null) {
            return Validated.invalid("Age is required");
        } else if (age < 18 || age > 100) {
            return Validated.invalid("Age must be between 18 and 100");
        } else {
            return Validated.valid(age);
        }
    }

    public Validated<String, String> validateCity(String city) {
        if (city == null || city.trim().isEmpty()) {
            return Validated.invalid("City cannot be empty");
        } else if (!ALLOWED_CITIES.contains(city)) {
            return Validated.invalid("City must be one of " + ALLOWED_CITIES);
        } else {
            return Validated.valid(city);
        }
    }

    public Validated<String, String> validateEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return Validated.invalid("Email cannot be empty");
        } else if (!EMAIL_PATTERN.matcher(email).matches()) {
            return Validated.invalid("Invalid email format");
        } else {
            return Validated.valid(email);
        }
    }

    public Validated<String, String> validatePassword(String password) {
        if (password == null || password.trim().isEmpty()) {
            return Validated.invalid("Password cannot be empty");
        } else if (!PASSWORD_PATTERN.matcher(password).matches()) {
            return Validated.invalid(
                "Password must be at least 8 characters long and contain at least one number and one special character");
        } else {
            return Validated.valid(password);
        }
    }

    public Validated<List<String>, String> validatePerson(String name, Integer age, String city,
        String email, String password) {
        List<Validated<String, ?>> validations = List.of(
            validateName(name),
            validateAge(age),
            validateCity(city),
            validateEmail(email),
            validatePassword(password)
        );

        return Validated.mapN(
            values -> "Person validated successfully",
            validations
        );
    }
}

```

### Implementing the Person Controller

Finally, we will implement a REST controller that will expose an endpoint to validate the person's information.

```java
package com.soumakis.example;

import com.soumakis.example.domain.PersonRequest;
import com.soumakis.example.domain.PersonValidator;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/person")
public class PersonController {

    private final PersonValidator personValidator;

    public PersonController(PersonValidator personValidator) {
        this.personValidator = personValidator;
    }

    @PostMapping
    public ResponseEntity<?> addPerson(@RequestBody PersonRequest personRequest) {
        Validated<List<String>, String> validationResult = personValidator.validatePerson(
            personRequest.name(),
            personRequest.age(),
            personRequest.city(),
            personRequest.email(),
            personRequest.password()
        );

        if (validationResult.isValid()) {
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.badRequest().body(validationResult.getInvalid());
        }
    }
}

```

### Running the Application

You can run the application by executing the following command:

```shell
mvn spring-boot:run
```

An endpoint is going to be exposed at port 8080. You can send a POST request to `http://localhost:8080/api/person` with
various payloads to test the validation.

```json
{
  "name": "John Doe",
  "age": 25,
  "city": "New York",
  "email": "",
  "password": "Something@123"
}
```

should fail with a 400 response containing the error message "Email cannot be empty".

### How it differs from a traditional imperative style of using jakarta.validation annotations

The traditional way of validating a form in a Spring Boot application is to use the jakarta.validation annotations.
While this approach seems simple and easy to use, it has some limitations. For example, it does not allow you to
accumulate
errors in a computation. If there are multiple errors in the form, it will short-circuit on the first error and return a
400 response with only that error.

Additionally, the jakarta.validation annotations are not composable. If you have multiple validation rules that depend
on each other, it can be challenging to express them using the jakarta.validation annotations.

Moreover, the jakarta.validation annotations are not type-safe. If you make a mistake in the validation logic, you will
only find out at runtime when the validation fails. Also, jakarta.validation annotations are not easily testable. You
have to run the entire Spring Boot application to test the validation logic whereas with the Validated monad, you can
test the validation logic in isolation.

Also the jakarta.validation annotations are using runtime reflection to validate the form which can be slow and
error-prone. The Validated monad, on the other hand, is a compile-time construct that is type-safe and efficient.

Finally, it can be used with any framework, not just Spring.

### Wait, we can use BindingResult with Spring to accumulate errors in a computation. Why not use that?

Spring provides a way to accumulate errors in a computation using the BindingResult class. You can use the BindingResult
class to accumulate errors in a form validation. However, the BindingResult class is not composable. If you have
multiple validation rules that depend on each other, it can be challenging to express them using the BindingResult
class.

Additionally, using the BindingResult implies that you have correctly configured the @Valid annotation on the controller
method parameter. If you forget to add the @Valid annotation, the validation will not be performed, and you will not get
any errors.

### Should we always use Validated monad for validation?

The Validated monad is a powerful tool for accumulating errors in a computation. However, it is not always necessary to
use the Validated monad for validation. If you have a simple form with only a few validation rules that do not depend on
each other, you can use the jakarta.validation annotations or the BindingResult class to validate the form.

## Conclusion

In this article, we implemented a `Validated` monad in Java and demonstrated how to use it with Spring Boot to validate
a
form containing some person specific information and accumulate errors. We compared the Validated monad with the
traditional imperative style of using jakarta.validation annotations and the BindingResult class for form validation.
We also discussed when to use the Validated monad for validation and when not to use it.

