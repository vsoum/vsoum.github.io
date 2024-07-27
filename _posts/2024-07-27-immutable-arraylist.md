---
layout: post
tags: [ Functional Programming, Java ]
title: "Immutable Java ArrayList Monad"
featured_image_thumbnail: assets/images/posts/functional/arrayseq_thumbnail.webp
featured_image: assets/images/posts/functional/arrayseq.webp
---

In this article, we are going to demonstrate how to implement an immutable ArrayList-Like Monad in Java. We will discuss
the pros and cons of this approach and how it can be used to enhance a more functional programming style in Java.

<!--more--> 

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url
2024-07-11-what-is-functional-programming %})

For implementing a persistent and immutable LinkedList you can read [here]({{ site.baseurl }}{% post_url
2024-07-22-persistent-and-immutable-list %})

For the complete implementation and many other useful monads and structures you can check
the [FunctionalUtils library](https://github.com/VassilisSoum/FunctionalUtils)

## Introduction

### What is an ArrayList

An ArrayList is a resizable array implementation in Java. It is a part of the Java Collections Framework and is
implemented in the `java.util` package. It is a dynamic array that can grow or shrink in size. It is similar to an
array but has more functionalities than a simple array.

An ArrayList is mutable in nature, which means that the elements of an ArrayList can be changed or modified.
This has the implication that extra care needs to be taken when sharing the ArrayList between different parts of the
code or when accessing the list from multiple threads as it is not a thread safe data structure.

### What exists for ensuring thread safety for an ArrayList

1. Java provides a `Collections.synchronizedList` method that wraps an ArrayList and returns a synchronized list.
2. Java provides a `CopyOnWriteArrayList` class that is a thread-safe and mutable variant of ArrayList in which all
   mutative operations are implemented by making a fresh copy of the underlying array.

### What is an Immutable ArrayList

An immutable ArrayList is a list that cannot be changed after it is created. This means that once the list is created,
it cannot be modified. Any operation that would modify the list will instead create a new list with the modified
elements. This has the implication that the list is thread safe and can be shared between different parts of the code
without any issues.

Performance wise, an immutable list is not as efficient as a mutable list as it requires creating a new list every time
a modification is made. However, the benefits of immutability are that it is thread safe and can be shared between
different parts of the code without any issues.

## Proposal

Our immutable variation of the known Java ArrayList will be called `ArraySeq`. It will be a monad that will provide
functional programming capabilities to Java. The `ArraySeq` will be an immutable list that will provide the following
functional programming capabilities:

1. **Map**: Apply a function to each element of the list and return a new list with the results.
2. **Filter**: Filter the elements of the list based on a predicate and return a new list with the filtered elements.
3. **FlatMap**: Apply a function to each element of the list and return a new list with the results. The function
   returns a list and the results are concatenated.
4. **Update**: Update an element at a specific index and return a new list with the updated element.
5. **Append**: Append an element to the end of the list and return a new list with the appended element.
6. **Prepend**: Prepend an element to the start of the list and return a new list with the prepended element.
7. **Delete**: Delete an element at a specific index and return a new list without the deleted element.
8. **Retrieve**: Retrieve an element at a specific index.

### Differences between ArraySeq and Collections.unmodifiableList

1. Collections.unmodifiableList returns a view of the list that is unmodifiable. This means that the original list
   can still be modified and the unmodifiable list will reflect these changes. In contrast, the ArraySeq is an
   immutable list that cannot be modified after it is created.
2. Collections.unmodifiableList is not a monad and does not provide functional programming capabilities such as `map`,
   `filter`, `flatMap`, etc. In contrast, the ArraySeq is a monad that provides these functional programming
   capabilities.
3. Collections.unmodifiableList is not thread safe. In contrast, the ArraySeq is an immutable list that is thread
   safe and can be shared between different parts of the code without any issues.
4. Collections.unmodifiableList will throw an `UnsupportedOperationException` if a modification operation is called.
   In contrast, the ArraySeq will return a new list with the modified elements. This means that the ArraySeq is more
   predictable as the frequent problem with Collections.unmodifiableList is that typically a java.util.List is
   returned and cannot be distinguished from a mutable list.

## Implementation

```java
public final class ArraySeq<T> {

  private final T[] elements;
  private final int length;

  private ArraySeq(T[] elements) {
    this.elements = elements;
    length = elements.length;
  }

  /**
   * Creates a new sequence with the given elements.
   *
   * @param elements the elements to add
   * @param <T>      the type of the elements
   * @return a new sequence with the elements added
   */
  @SafeVarargs
  public static <T> ArraySeq<T> of(T... elements) {
    return new ArraySeq<>(elements);
  }

  /**
   * Creates an empty sequence.
   *
   * @param <T> the type of the elements
   * @return an empty sequence
   */
  @SuppressWarnings("unchecked")
  public static <T> ArraySeq<T> empty() {
    return new ArraySeq<>((T[]) new Object[0]);
  }

  /**
   * Returns the length of the sequence.
   *
   * @return the length of the sequence
   */
  public int length() {
    return length;
  }

  /**
   * Appends the given elements to the sequence. Since it is an immutable data structure, it returns
   * a new sequence with the elements appended.
   *
   * @param elementsToAppend the elements to append
   * @return a new sequence with the elements appended
   */
  @SuppressWarnings("unchecked")
  public ArraySeq<T> append(T... elementsToAppend) {
    var newElements = (T[]) new Object[length + elementsToAppend.length];
    System.arraycopy(this.elements, 0, newElements, 0, length);
    System.arraycopy(elementsToAppend, 0, newElements, length, elementsToAppend.length);
    return new ArraySeq<>(newElements);
  }

  /**
   * Appends the given sequence to the sequence. Since it is an immutable data structure, it returns
   * a new sequence with the elements appended.
   *
   * @param other the sequence to append
   * @return a new sequence with the elements appended
   */
  public ArraySeq<T> append(ArraySeq<T> other) {
    return append(other.elements);
  }

  /**
   * Prepends the given elements to the sequence. Since it is an immutable data structure, it
   * returns a new sequence with the elements prepended.
   *
   * @param elementsToPrepend the elements to prepend
   * @return a new sequence with the elements prepended
   */
  @SuppressWarnings("unchecked")
  public ArraySeq<T> prepend(T... elementsToPrepend) {
    var newElements = (T[]) new Object[length + elementsToPrepend.length];
    System.arraycopy(elementsToPrepend, 0, newElements, 0, elementsToPrepend.length);
    System.arraycopy(this.elements, 0, newElements, elementsToPrepend.length, length);
    return new ArraySeq<>(newElements);
  }

  /**
   * Updates the element at the given index with the updated value. Since it is an immutable data
   * structure, it returns a new sequence with the element updated.
   *
   * @param index        the index of the element to update
   * @param updatedValue the updated value
   * @return a new sequence with the element updated
   * @throws IndexOutOfBoundsException if the index is out of bounds
   */
  @SuppressWarnings("unchecked")
  public ArraySeq<T> update(int index, T updatedValue) {
    checkBounds(index);
    var newElements = (T[]) new Object[length];
    System.arraycopy(elements, 0, newElements, 0, length);
    newElements[index] = updatedValue;
    return new ArraySeq<>(newElements);
  }

  /**
   * Updates the element at the given index with the evaluation of the computation represented as an
   * {@link  Supplier}. Since it is an immutable data structure, it returns a new sequence with the
   * element updated.
   *
   * @param index                      the index of the element to update
   * @param computationForUpdatedValue the computation to evaluate for the updated value
   * @return a new sequence with the element updated
   * @throws IndexOutOfBoundsException if the index is out of bounds
   */
  @SuppressWarnings("unchecked")
  public ArraySeq<T> update(int index, Supplier<T> computationForUpdatedValue) {
    checkBounds(index);
    var newElements = (T[]) new Object[length];
    System.arraycopy(elements, 0, newElements, 0, length);
    newElements[index] = computationForUpdatedValue.get();
    return new ArraySeq<>(newElements);
  }

  /**
   * Returns the element at the given index.
   *
   * @param index the index of the element to get
   * @return the element at the given index
   * @throws IndexOutOfBoundsException if the index is out of bounds
   */
  public T get(int index) {
    checkBounds(index);
    return elements[index];
  }

  /**
   * Deletes the element at the given index. Since it is an immutable data structure, it returns a
   * new sequence with the element deleted.
   *
   * @param index the index of the element to delete
   * @return a new sequence with the element deleted
   * @throws IndexOutOfBoundsException if the index is out of bounds
   */
  @SuppressWarnings("unchecked")
  public ArraySeq<T> delete(int index) {
    checkBounds(index);
    var newElements = (T[]) new Object[length - 1];
    System.arraycopy(elements, 0, newElements, 0, index);
    System.arraycopy(elements, index + 1, newElements, index, length - index - 1);
    return new ArraySeq<>(newElements);
  }

  /**
   * Maps the elements of the sequence to a new sequence using the given function. The complexity of
   * this method is O(n) where n is the number of elements.
   *
   * @param fn  the function to map the elements
   * @param <U> the type of the elements of the new sequence
   * @return a new sequence with the elements mapped
   */
  @SuppressWarnings("unchecked")
  public <U> ArraySeq<U> map(Function<? super T, ? extends U> fn) {
    var newElements = (U[]) new Object[length];
    for (int i = 0; i < length; i++) {
      newElements[i] = fn.apply(elements[i]);
    }
    return new ArraySeq<>(newElements);
  }

  /**
   * Applies a flat map function to the elements of the sequence. The complexity of this method is
   * O(n) where n is the number of elements.
   *
   * @param fn  the flat map function
   * @param <U> the type of the elements of the new sequence
   * @return a new sequence with the elements flat mapped
   */
  public <U> ArraySeq<U> flatMap(Function<? super T, ? extends ArraySeq<U>> fn) {
    List<U> temp = new ArrayList<>();

    for (int i = 0; i < length; i++) {
      ArraySeq<U> mapped = fn.apply(elements[i]);
      for (int j = 0; j < mapped.length; j++) {
        temp.add(mapped.get(j));
      }
    }

    @SuppressWarnings("unchecked")
    U[] finalArray = temp.toArray((U[]) new Object[0]);

    return new ArraySeq<>(finalArray);
  }

  /**
   * Filters the elements of the sequence using the given predicate. The complexity of this method
   * is O(n) where n is the number of elements.
   *
   * @param predicate the predicate to filter the elements
   * @return a new sequence with the elements filtered
   */
  public ArraySeq<T> filter(Predicate<T> predicate) {
    List<T> temp = new ArrayList<>();

    for (int i = 0; i < length; i++) {
      var element = elements[i];
      if (predicate.test(element)) {
        temp.add(element);
      }
    }

    @SuppressWarnings("unchecked")
    T[] finalArray = temp.toArray((T[]) new Object[0]);

    return new ArraySeq<>(finalArray);
  }

  /**
   * Converts the sequence to a {@link List}.
   * <p>
   * <b>NOTE: This method might break the immutability if the underlying elements of the generated
   * ArrayList are mutable</b>
   *
   * @return a {@link List} with the elements of the sequence
   */
  public List<T> toJavaArrayList() {
    return Arrays.asList(Arrays.copyOf(elements, length));
  }

  /**
   * Converts the sequence to a {@link Stream}.
   *
   * <p>
   * <b>NOTE: This method might break the immutability if the underlying elements of the generated
   * Stream are mutable</b>
   * </p>
   *
   * @return a {@link Stream} with the elements of the sequence
   */
  public Stream<T> stream() {
    return Arrays.stream(elements);
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    ArraySeq<?> arraySeq = (ArraySeq<?>) o;
    return length == arraySeq.length && Objects.deepEquals(elements, arraySeq.elements);
  }

  @Override
  public int hashCode() {
    return Objects.hash(Arrays.hashCode(elements), length);
  }

  private void checkBounds(int index) {
    if (index < 0 || index >= length) {
      throw new IndexOutOfBoundsException("Index out of bounds: " + index);
    }
  }

}
```

Notes:

1. The `ArraySeq` class is a final class to prevent inheritance.
2. The `ArraySeq` class is generic to allow the user to define the type of the elements.
3. The `ArraySeq` does not perform any deep copy of the elements. This means that if the elements are mutable, the
   immutability of the `ArraySeq` will be broken.
4. The `ArraySeq` class is an immutable data structure. This means that all the methods that would modify the list
   return a new list with the modified elements. This also means that although `System.arraycopy` is used to copy the
   elements, since it does not use any advanced data structure such as a trie, the complexity of the operations is
   O(n) where n is the number of elements. It is also not as efficient as a mutable list for large lists, but it is a
   great choice when immutability, thread safety and functional programming composition are more important than
   performance.
5. The `ArraySeq` class is a true monad as it provides the `map`, `flatMap`, `of` methods and also respect all monad
   laws.

## Usage

```java

public class ArraySeqExample {

  public static void main(String[] args) {
    ArraySeq<Integer> arraySeq = ArraySeq.of(1, 2, 3, 4, 5);

    // Map
    ArraySeq<Integer> mapped = arraySeq.map(x -> x * 2);
    System.out.println(mapped.toJavaArrayList()); // [2, 4, 6, 8, 10]

    // Filter
    ArraySeq<Integer> filtered = arraySeq.filter(x -> x % 2 == 0);
    System.out.println(filtered.toJavaArrayList()); // [2, 4]

    // FlatMap
    ArraySeq<Integer> flatMapped = arraySeq.flatMap(x -> ArraySeq.of(x, x * 2));
    System.out.println(flatMapped.toJavaArrayList()); // [1, 2, 2, 4, 3, 6, 4, 8, 5, 10]

    // Append
    ArraySeq<Integer> appended = arraySeq.append(6, 7, 8);
    System.out.println(appended.toJavaArrayList()); // [1, 2, 3, 4, 5, 6, 7, 8]

    // Prepend
    ArraySeq<Integer> prepended = arraySeq.prepend(0, -1, -2);
    System.out.println(prepended.toJavaArrayList()); // [0, -1, -2, 1, 2, 3, 4, 5]

    // Update
    ArraySeq<Integer> updated = arraySeq.update(2, 10);
    System.out.println(updated.toJavaArrayList()); // [1, 2, 10, 4, 5]

    // Delete
    ArraySeq<Integer> deleted = arraySeq.delete(2);
    System.out.println(deleted.toJavaArrayList()); // [1, 2, 4, 5]

    // Retrieve
    System.out.println(arraySeq.get(2)); // 3
  }

}
```

## Conclusion

In this article, we have demonstrated how to implement an immutable ArrayList-Like Monad in Java. We have discussed the
pros and cons of this approach and how it can be used to implement a functional programming style in Java. The
`ArraySeq` class is a true monad as it provides the `map`, `flatMap`, `of` methods and also respect all monad laws.
It is a great choice when immutability, thread safety and functional programming composition are more important than
performance.

