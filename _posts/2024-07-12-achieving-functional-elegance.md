---
layout: post
title:  "Achieving Functional Elegance in Java with Vavr"
tags: [ Java, Functional Programming ]
featured_image_thumbnail: assets/images/posts/functional/functional-elegance_thumbnail.webp
featured_image: assets/images/posts/functional/functional-elegance.webp
---

In this article I am going to demonstrate how to convert imperative, mutable code written in Java into functional style 
to achieve immutability, type safety, clear error handling and maintainability in a step by step guide.

We will be needing at least Java 16 to fully utilize the proposed solution. However previous versions of Java 16 can still 
be adapted with minimal changes.

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url 2024-07-11-what-is-functional-programming %})

<!--more-->

Let’s demonstrate an example of a mutable class written in Java.

<pre><code class="language-java">
import java.util.ArrayList;
import java.util.List;

public class BankAccount {
  private String accountNumber;
  private String accountHolder;
  private double balance;
  private List&lt;String&gt; transactions;

  public BankAccount() {
    this.accountNumber = "";
    this.accountHolder = "";
    this.balance = 0.0;
    this.transactions = new ArrayList&lt;&gt;();
  }

  public BankAccount(String accountNumber, String accountHolder, double balance, List&lt;String&gt; transactions) {
    this.accountNumber = accountNumber;
    this.accountHolder = accountHolder;
    this.balance = balance;
    this.transactions = transactions;
  }

  public String getAccountNumber() {
    return accountNumber;
  }

  public void setAccountNumber(String accountNumber) {
    this.accountNumber = accountNumber;
  }

  public String getAccountHolder() {
    return accountHolder;
  }

  public void setAccountHolder(String accountHolder) {
    this.accountHolder = accountHolder;
  }

  public double getBalance() {
    return balance;
  }

  public void setBalance(double balance) {
    this.balance = balance;
  }

  public List&lt;String&gt; getTransactions() {
    return transactions;
  }

  public void setTransactions(List&lt;String&gt; transactions) {
    this.transactions = transactions;
  }

  public void deposit(double amount) throws IllegalArgumentException {
    if (amount <= 0) {
      throw new IllegalArgumentException("Deposit amount must be positive");
    }
    balance += amount;
    transactions.add("Deposited: $" + amount);
  }

  public void withdraw(double amount) throws IllegalArgumentException, IllegalStateException {
    if (amount <= 0) {
      throw new IllegalArgumentException("Withdrawal amount must be positive");
    }
    if (balance < amount) {
      throw new IllegalStateException("Insufficient balance");
    }
    balance -= amount;
    transactions.add("Withdrew: $" + amount);
  }

  @Override
  public String toString() {
    return "BankAccount{accountNumber='" + accountNumber + "', accountHolder='" + accountHolder + "', balance=" + balance + ", transactions=" + transactions + "}";
  }
}
</code></pre>

The issues with this class are:
- Mutability of transactions list. The list is accessible via a getter which is problematic because it can be modified externally.
- The transactions list is assigned directly in the parameterized constructor, which can lead to aliasing issues. Any changes to the list outside the class will reflect in the object.
- Mutability of the class members themselves. For example, the balance is mutated on each call and therefore cannot be made final.
- If this class is intended to be used in a multi-threaded environment, the methods to deposit and withdraw money should be synchronized to avoid race conditions.
- There is no validation for the parameters in the parameterized constructor. Invalid initial values could lead to inconsistent state.
- No documentation for the public methods to explain their intended purpose or what exceptions they throw.

**But we can do better**

## Transforming to functional style

The functional style solution should contain these traits:
- Immutability. The fields should be final and the transactions list should be immutable.
- Type safety. The parameters should be validated and they should be clearly distinguishable among each other.
- Clear error handling. There should not be exceptions for controlling the flow but rather types dictating the presence or not of a failure state.
- Encapsulation of business logic. The methods deposit and withdraw should ensure that any operations keep the class instance in a valid state.
- The code block should be readable and maintainable and as much as self documented as possible.

To achieve the above, the code should contain
- [Vavr](https://github.com/vavr-io/vavr)’s `Try` to represent failures instead of using exceptions. It provides a functional approach to error handling that aligns with the principles of functional programming, offering clear, maintainable, and type-safe error management compared to traditional exceptions. It makes the error handling explicit in function signatures, encapsulates errors and keeps the logic clean.
- Domain specific classes like `NonEmptyString`, `NonNegative`, and `Positive` which enforce type safety and making the code more readable and predictable.
- Immutability. The fields are final and there is no internal modification of state but rather a new instance is created on each operation. This allows us to avoid expensive and complex synchronization solutions.

### Definition of supporting classes for type safety

Let's first define `NonEmptyString`. This type should wrap a non empty string and provide a static factory 
method with a signature of `Try` wrapping any illegal state and allowing us to handle gracefully any exception in a monadic style.
Additionally it should provide an "unsafe" static factory method which is useful when the value is known from the compile time and therefore 
there is no need to return a `Try`.

<pre><code class="language-java">
import io.vavr.control.Try;

/**
 * Represents a non-empty string. This class ensures that the string value it encapsulates is not null and not empty.
 */
public final class NonEmptyString {
    private final String value;

    /**
     * Private constructor to prevent instantiation with invalid strings directly.
     * 
     * @param value The string value to encapsulate. Must not be null or empty.
     * @throws IllegalArgumentException if the provided string is null or empty.
     */
    private NonEmptyString(String value) {
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException("String must not be empty");
        }
        this.value = value;
    }

    /**
     * Factory method to create a {@link NonEmptyString} instance safely.
     * This method returns a {@link Try} instance, encapsulating either a successful
     * creation of a {@link NonEmptyString} or an exception if the input is invalid.
     * 
     * @param value The string value to encapsulate.
     * @return A {@link Try} instance containing either a {@link NonEmptyString} or an exception.
     */
    public static Try&lt;NonEmptyString&gt; of(String value) {
        return Try.of(() -> new NonEmptyString(value));
    }

    /**
     * Factory method to create a {@link NonEmptyString} instance unsafely especially when the value is known at 
     * compile time.
     * This method throws an IllegalArgumentException if the input is invalid.
     * 
     * @param value The string value to encapsulate. Must not be null or empty.
     * @return A {@link NonEmptyString} instance.
     * @throws IllegalArgumentException if the provided string is null or empty.
     */
    public static NonEmptyString unsafeOf(String value) {
        return new NonEmptyString(value);
    }

    /**
     * Retrieves the encapsulated string value.
     * 
     * @return The non-null, non-empty string value.
     */
    public String getValue() {
        return value;
    }

    /**
     * Returns the string representation of the encapsulated value.
     * 
     * @return The non-null, non-empty string value.
     */
    @Override
    public String toString() {
        return value;
    }
}
</code></pre>

Similarly, 

<pre><code class="language-java">
import io.vavr.control.Try;

/**
 * Represents a non-negative numeric value. This class ensures that the double value it encapsulates is not negative.
 */
public final class NonNegative {
    private final double value;

    /**
     * Private constructor to prevent instantiation with negative values directly.
     *
     * @param value The numeric value to encapsulate. Must not be negative.
     * @throws IllegalArgumentException if the provided value is negative.
     */
    private NonNegative(double value) {
        if (value < 0) {
            throw new IllegalArgumentException("Value must not be negative");
        }
        this.value = value;
    }

    /**
     * Factory method to create a {@link NonNegative} instance safely.
     * This method returns a {@link Try} instance, encapsulating either a successful
     * creation of a {@link NonNegative} or an exception if the input is negative.
     *
     * @param value The numeric value to encapsulate. Can be negative, but will result in a failure.
     * @return A {@link Try} instance containing either a {@link NonNegative} or an exception.
     */
    public static Try&lt;NonNegative&gt; of(double value) {
        return Try.of(() -> new NonNegative(value));
    }

    /**
     * Factory method to create a {@link NonNegative} instance unsafely.
     * This method throws an IllegalArgumentException if the input is negative.
     *
     * @param value The numeric value to encapsulate. Must not be negative.
     * @return A {@link NonNegative} instance.
     * @throws IllegalArgumentException if the provided value is negative.
     */
    public static NonNegative unsafeOf(double value) {
        return new NonNegative(value);
    }

    /**
     * Retrieves the encapsulated numeric value.
     *
     * @return The non-negative numeric value.
     */
    public double getValue() {
        return value;
    }

    /**
     * Adds a specified amount to the current value, ensuring the result is non-negative.
     *
     * @param amount The amount to add. The sum must not result in a negative value.
     * @return A new {@link NonNegative} instance representing the sum.
     */
    public NonNegative add(double amount) {
        return new NonNegative(value + amount);
    }

    /**
     * Subtracts a specified amount from the current value safely.
     * This method returns a {@link Try} instance, encapsulating either a successful
     * subtraction resulting in a {@link NonNegative} or an exception if the result would be negative.
     *
     * @param amount The amount to subtract. The difference must not result in a negative value.
     * @return A {@link Try} instance containing either a {@link NonNegative} or an exception.
     */
    public Try&lt;NonNegative&gt; subtract(double amount) {
        return value >= amount
            ? Try.success(new NonNegative(value - amount))
            : Try.failure(new IllegalArgumentException("Resulting value would be negative"));
    }

    /**
     * Returns the string representation of the encapsulated numeric value.
     *
     * @return The string representation of the non-negative numeric value.
     */
    @Override
    public String toString() {
        return String.valueOf(value);
    }
}
</code></pre>

And 

<pre><code class="language-java">
import io.vavr.control.Try;

/**
 * Represents a positive numeric value. This class ensures that the double value it encapsulates is strictly positive.
 */
public final class Positive {
    private final double value;

    /**
     * Private constructor to prevent instantiation with non-positive values directly.
     *
     * @param value The numeric value to encapsulate. Must be positive.
     * @throws IllegalArgumentException if the provided value is not positive.
     */
    private Positive(double value) {
        if (value <= 0) {
            throw new IllegalArgumentException("Value must be positive");
        }
        this.value = value;
    }

    /**
     * Factory method to create a {@link Positive} instance safely.
     * This method returns a {@link Try} instance, encapsulating either a successful
     * creation of a {@link Positive} or an exception if the input is not positive.
     *
     * @param value The numeric value to encapsulate. Can be non-positive, but will result in a failure.
     * @return A {@link Try} instance containing either a {@link Positive} or an exception.
     */
    public static Try&lt;Positive&gt; of(double value) {
        return Try.of(() -> new Positive(value));
    }

    /**
     * Factory method to create a {@link Positive} instance unsafely.
     * This method throws an IllegalArgumentException if the input is not positive.
     *
     * @param value The numeric value to encapsulate. Must be positive.
     * @return A {@link Positive} instance.
     * @throws IllegalArgumentException if the provided value is not positive.
     */
    public static Positive unsafeOf(double value) {
        return new Positive(value);
    }

    /**
     * Retrieves the encapsulated numeric value.
     *
     * @return The positive numeric value.
     */
    public double getValue() {
        return value;
    }

    /**
     * Adds a specified amount to the current value, ensuring the result remains positive.
     *
     * @param amount The amount to add. The sum must remain positive.
     * @return A new {@link Positive} instance representing the sum.
     */
    public Positive add(double amount) {
        return new Positive(value + amount);
    }

    /**
     * Subtracts a specified amount from the current value safely.
     * This method returns a {@link Try} instance, encapsulating either a successful
     * subtraction resulting in a {@link Positive} or an exception if the result would not be positive.
     *
     * @param amount The amount to subtract. The difference must remain positive.
     * @return A {@link Try} instance containing either a {@link Positive} or an exception.
     */
    public Try&lt;Positive&gt; subtract(double amount) {
        return value > amount
            ? Try.success(new Positive(value - amount))
            : Try.failure(new IllegalArgumentException("Resulting value would not be positive"));
    }

    /**
     * Returns the string representation of the encapsulated numeric value.
     *
     * @return The string representation of the positive numeric value.
     */
    @Override
    public String toString() {
        return String.valueOf(value);
    }
}
</code></pre>

The previous mutable class can utilize the types defined to achieve a valid state upon creation of an instance. 
Additionally, to ensure immutability we need to:

1. Convert the class to `record` which will allow our members to be final.
2. Make a defensive copy of the passed transactions list.
3. Convert the deposit and withdraw methods to be immutable and not modify any internal state of the instance.

<pre><code class="language-java">
import io.vavr.control.Try;
import java.util.ArrayList;
import java.util.List;

public record BankAccountRefactored(
    NonEmptyString accountNumber,
    NonEmptyString accountHolder,
    NonNegative balance,
    List&lt;NonEmptyString&gt; transactions) {

    public BankAccountRefactored {
        transactions = List.copyOf(transactions); // Ensure immutability
    }

    // Method to deposit amount and return new instance
    public BankAccountRefactored deposit(Positive amount) {
        List&lt;NonEmptyString&gt; updatedTransactions = new ArrayList&lt;&gt;(transactions);
        updatedTransactions.add(NonEmptyString.unsafeOf("Deposited: $" + amount.getValue()));
        return new BankAccountRefactored(
            accountNumber, accountHolder, balance.add(amount.getValue()), updatedTransactions);
    }

    // Method to withdraw amount and return new instance or failure
    public Try&lt;BankAccountRefactored&gt; withdraw(Positive amount) {
        if (balance.getValue() < amount.getValue()) {
            return Try.failure(new IllegalStateException("Insufficient balance"));
        }
        List&lt;NonEmptyString&gt; updatedTransactions = new ArrayList&lt;&gt;(transactions);
        updatedTransactions.add(NonEmptyString.unsafeOf("Withdrew: $" + amount.getValue()));
        return balance
            .subtract(amount.getValue())
            .map(newBalance -> new BankAccountRefactored(
                accountNumber, accountHolder, newBalance, updatedTransactions));
    }

    @Override
    public String toString() {
        return "BankAccount{accountNumber='"
            + accountNumber
            + "', accountHolder='"
            + accountHolder
            + "', balance="
            + balance.getValue()
            + ", transactions="
            + transactions
            + "}";
    }
}
</code></pre>

### Example usage

<pre><code class="language-java">
public class Main {
    public static void main(String[] args) {
    Try&lt;NonEmptyString&gt; accountNumber = NonEmptyString.of("123456");
    Try&lt;NonEmptyString&gt; accountHolder = NonEmptyString.of("John Doe");
    Try&lt;NonNegative&gt; initialBalance = NonNegative.of(100.0);

    createAccount(accountNumber, accountHolder, initialBalance)
        .map(account -> account.deposit(Positive.unsafeOf(50.0)))
        .flatMap(account -> account.withdraw(Positive.unsafeOf(30.0)))
        .onSuccess(System.out::println)
        .onFailure(System.err::println);
  }

  private static Try&lt;BankAccountRefactored&gt; createAccount(
      Try&lt;NonEmptyString&gt; accountNumber,
      Try&lt;NonEmptyString&gt; accountHolder,
      Try&lt;NonNegative&gt; initialBalance
  ) {
    return accountNumber.flatMap(number ->
        accountHolder.flatMap(holder ->
            initialBalance.map(balance ->
                new BankAccountRefactored(number, holder, balance, List.of())
            )
        )
    );
  }
}
</code></pre>

### What the new code achieves:

1. Ensures Valid State: Instances of BankAccountRefactored are guaranteed to be in a valid state.
2. Improved Error Handling: Using Try for operations provides a clear and safe way to handle errors, avoiding exceptions for normal control flow.
3. Immutable and Thread-Safe: The code is inherently thread-safe and immutable.
4. Self-Documenting Code: The code structure and naming make it clear what each class and method does.
5. Functional Approach: Using a functional style with immutable data structures and safe operations aligns with best practices in software design.
