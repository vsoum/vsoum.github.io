---
layout: post
title: "Implementing a custom Spring Transaction Interceptor"
tags: [ Java, Spring Boot ]
featured_image_thumbnail: assets/images/posts/misc/spring_thumbnail.png
featured_image: assets/images/posts/misc/spring.png
---

In this article, we are going to implement a custom Spring Transaction Interceptor that will allow us to intercept the
transactional behavior of our Spring Boot application. We are going to see how we can use this interceptor to allow
using the `Try` monad to handle exceptions in a more functional way while retaining the transactional behavior of the
`@Transactional` annotation we are used to.

<!--more--> 

For a convenient zero-dependencies library allowing you to start using useful functional programming constructs you can
check out the [FunctionalUtils library](https://github.com/VassilisSoum/FunctionalUtils)

For an introduction to functional programming you can read [here]({{ site.baseurl }}{% post_url
2024-07-11-what-is-functional-programming %}).

## Introduction

Spring Boot provides a convenient way to manage transactions using the `@Transactional` annotation. This annotation
allows us to define transactional boundaries around methods and classes, ensuring that the transaction is committed or
rolled back based on the method's outcome.

Traditionally, the preferred way is to throw an exception to signal a failure and rollback the transaction. However,
there is another approach for those that wish to embrace functional programming principles. This approach involves
using the `Try` monad to handle exceptions in a more functional way while retaining the transactional behavior of the
@Transactional annotation.

Using the Try monad allows us to handle exceptions in a more functional way, providing a more expressive and
composable way to deal with errors. The Try monad is a container that represents either a successful computation
or a failed computation. It is similar to the Optional monad, but instead of representing the absence of a value,
it represents the presence of a value or an exception.

The challenge is to combine the transactional behavior of the @Transactional annotation with the functional error
handling provided by the Try monad. In this article, we are going to implement a custom Spring Transaction Interceptor
that will allow us to intercept the transactional behavior of our Spring Boot application.

## Implementing the custom Spring Transaction Interceptor

To implement a custom Spring Transaction Interceptor, we need to create a class that extends
the `TransactionInterceptor` class provided by Spring.

The TransactionInterceptor class is part of the Spring framework and is used to manage transactions around method
invocations. It is responsible for starting, committing, and rolling back transactions based on the method's outcome.

Our custom interceptor will extend the TransactionInterceptor class and override the `invokeWithinTransaction` method.

Let's see the implementation of the custom Spring Transaction Interceptor:

```java

import com.soumakis.control.Try;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serial;
import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import lombok.SneakyThrows;
import org.aopalliance.intercept.MethodInvocation;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.lang.Nullable;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.transaction.interceptor.DefaultTransactionAttribute;
import org.springframework.transaction.interceptor.TransactionAttribute;
import org.springframework.transaction.interceptor.TransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.CallbackPreferringPlatformTransactionManager;
import org.springframework.util.ClassUtils;

/**
 * CustomTransactionInterceptor is a Spring AOP MethodInterceptor for managing transactions in
 * methods that return Try monad types. It extends TransactionInterceptor to utilize its transaction
 * management functionalities.
 */
public class CustomTransactionInterceptor extends TransactionInterceptor {

  public CustomTransactionInterceptor(TransactionManager transactionManager,
      TransactionAttributeSource tas) {
    super(transactionManager, tas);
  }

  @Override
  @Nullable
  public Object invoke(MethodInvocation invocation) {
    Class<?> targetClass = (invocation.getThis() != null ? AopUtils.getTargetClass(
        invocation.getThis()) : null);

    return invokeWithinTransaction(invocation.getMethod(), targetClass, invocation::proceed);
  }

  /**
   * Invokes the method within a transaction and manages the transaction based on the return type of
   * the method. If the method returns a Try type, it will manage the transaction accordingly.
   * Otherwise, it will manage the transaction as usual.
   *
   * @param method      the Method being invoked
   * @param targetClass the target class that we're invoking the method on
   * @param invocation  the callback to use for proceeding with the target invocation
   * @return the result of the method invocation
   */
  @Override
  @Nullable
  protected Object invokeWithinTransaction(Method method, @Nullable Class<?> targetClass,
      final InvocationCallback invocation) {
    // Retrieves the source of the transaction attribute which can be via spring configuration,
    // programmatic transaction management or annotation based
    // or null if no transaction attribute is found.
    TransactionAttributeSource transactionAttributeSource = getTransactionAttributeSource();
    final TransactionAttribute transactionAttribute = (transactionAttributeSource != null)
        ? transactionAttributeSource.getTransactionAttribute(method, targetClass) : null;
    // Retrieves the transaction manager to be used for managing the transaction
    final TransactionManager transactionManager = determineTransactionManager(transactionAttribute);

    // Typically we operate only on PlatformTransactionManager
    PlatformTransactionManager platformTransactionManager = asPlatformTransactionManager(
        transactionManager);

    // Retrieves the method aop joinpoint identification
    final String joinpointIdentification = methodIdentification(method, targetClass,
        transactionAttribute);

    if (transactionAttribute == null
        || !(platformTransactionManager instanceof CallbackPreferringPlatformTransactionManager)) {
      return handleStandardTransaction(method, platformTransactionManager, transactionAttribute,
          joinpointIdentification, invocation);
    } else {
      return handleCallbackPreferringTransaction(
          method,
          (CallbackPreferringPlatformTransactionManager) platformTransactionManager,
          transactionAttribute, joinpointIdentification, invocation);
    }
  }

  /**
   * Handles a standard transaction by creating a transaction if necessary, proceeding with the
   * method invocation, evaluating the transaction, and cleaning up the transaction info.
   *
   * @param method                     the method being invoked
   * @param platformTransactionManager the transaction manager
   * @param transactionAttribute       the transaction attribute
   * @param joinpointIdentification    the identification of the joinpoint
   * @param invocation                 the callback to use for proceeding with the target
   *                                   invocation
   * @return the result of the method invocation
   */
  private Object handleStandardTransaction(
      Method method,
      PlatformTransactionManager platformTransactionManager,
      TransactionAttribute transactionAttribute,
      String joinpointIdentification, InvocationCallback invocation) {
    TransactionInfo txInfo = createTransactionIfNecessary(platformTransactionManager,
        transactionAttribute, joinpointIdentification);
    AtomicReference<Object> retVal = new AtomicReference<>();

    try {
      retVal.set(invocation.proceedWithInvocation());
      return processTransactionResult(transactionAttribute, txInfo, retVal);
    } catch (Throwable ex) {
      return handleTransactionException(method, ex, txInfo);
    } finally {
      cleanupTransactionInfo(txInfo);
    }
  }

  private Try<Object> handleTransactionException(Method method, Throwable ex,
      TransactionInfo txInfo) {
    rollback(txInfo,
        ignored -> super.completeTransactionAfterThrowing(txInfo, ex));
    if (method.getReturnType().isAssignableFrom(Try.class)) {
      return Try.failure(ex);
    }
    throw new RuntimeException(ex);
  }

  private Object processTransactionResult(TransactionAttribute transactionAttribute,
      TransactionInfo txInfo,
      AtomicReference<Object> retVal) {
    if (transactionAttribute != null) {
      return evaluateTransaction(txInfo, retVal, transactionAttribute);
    }
    // It means that no transaction is demarcated.
    return retVal;
  }

  /**
   * Handles a callback preferring transaction by executing the transaction, proceeding with the
   * method invocation, evaluating the transaction, and cleaning up the transaction info.
   *
   * @param method                     the Method being invoked
   * @param platformTransactionManager the transaction manager
   * @param transactionAttribute       the transaction attribute
   * @param joinpointIdentification    the identification of the joinpoint
   * @param invocation                 the callback to use for proceeding with the target
   *                                   invocation
   * @return the result of the method invocation
   */
  private Object handleCallbackPreferringTransaction(
      Method method,
      CallbackPreferringPlatformTransactionManager platformTransactionManager,
      TransactionAttribute transactionAttribute, String joinpointIdentification,
      InvocationCallback invocation) {
    try {
      return platformTransactionManager.execute(transactionAttribute, status -> {
        TransactionInfo txInfo = prepareTransactionInfo(platformTransactionManager,
            transactionAttribute, joinpointIdentification, status);
        try {
          return invocation.proceedWithInvocation();
        } catch (Throwable ex) {
          return handleTransactionException(method, ex, txInfo);
        } finally {
          cleanupTransactionInfo(txInfo);
        }
      });
    } catch (TransactionSystemException ex) {
      return Try.failure(ex);
    }
  }

  /**
   * Evaluates the transaction by committing the transaction after returning and returning the
   * result of the method invocation.
   *
   * @param txInfo               the transaction info
   * @param retVal               the result of the method invocation
   * @param transactionAttribute the transaction attribute
   * @return the result of the method invocation
   */
  private Object evaluateTransaction(TransactionInfo txInfo,
      AtomicReference<Object> retVal, TransactionAttribute transactionAttribute) {
    TransactionStatus status = txInfo.getTransactionStatus();
    if (status != null && (retVal.get() instanceof Try<?>)) {
      retVal.set(evaluateTryFailure(retVal, transactionAttribute, status));
      try {
        return commitTransaction(txInfo, retVal);
      } catch (Exception e) {
        // For any exception do not propagage the exception but respect the return type and return a Try#Failure.
        return Try.failure(e);
      }
    }
    return commitTransaction(txInfo, retVal);
  }

  private Object commitTransaction(TransactionInfo txInfo, AtomicReference<Object> retVal) {
    commitTransactionAfterReturning(txInfo);
    return retVal.get();
  }

  @Serial
  private void writeObject(ObjectOutputStream oos) throws IOException {
    oos.defaultWriteObject();
    oos.writeObject(getTransactionManagerBeanName());
    oos.writeObject(getTransactionManager());
    oos.writeObject(getTransactionAttributeSource());
    oos.writeObject(getBeanFactory());
  }

  @Serial
  private void readObject(ObjectInputStream ois) throws IOException, ClassNotFoundException {
    ois.defaultReadObject();
    setTransactionManagerBeanName((String) ois.readObject());
    setTransactionManager((PlatformTransactionManager) ois.readObject());
    setTransactionAttributeSource((TransactionAttributeSource) ois.readObject());
    setBeanFactory((BeanFactory) ois.readObject());
  }

  private PlatformTransactionManager asPlatformTransactionManager(
      @Nullable Object transactionManager) {
    if (transactionManager == null) {
      return null;
    }
    if (transactionManager instanceof PlatformTransactionManager ptm) {
      return ptm;
    } else {
      throw new IllegalStateException(
          "Specified transaction manager is not a PlatformTransactionManager: "
              + transactionManager);
    }
  }

  private String methodIdentification(Method method, @Nullable Class<?> targetClass,
      @Nullable TransactionAttribute transactionAttribute) {
    String methodIdentification = methodIdentification(method, targetClass);
    if (methodIdentification == null) {
      if (transactionAttribute instanceof DefaultTransactionAttribute dta) {
        methodIdentification = dta.getDescriptor();
      }
      if (methodIdentification == null) {
        methodIdentification = ClassUtils.getQualifiedMethodName(method, targetClass);
      }
    }
    return methodIdentification;
  }

  @SneakyThrows
  private void rollback(TransactionInfo txInfo, Consumer<?> rollbackAction) {
    if (txInfo.getTransactionStatus() != null) {
      rollbackAction.accept(null);
    }
  }

  private static Object evaluateTryFailure(AtomicReference<Object> retVal,
      TransactionAttribute txAttr,
      TransactionStatus status) {
    return ((Try<?>) retVal.get()).onFailure(ex -> {
      // This basically will respect the @Transactional(noRollbackFor= {...})
      if (txAttr.rollbackOn(ex)) {
        status.setRollbackOnly();
      }
    });
  }
}

```

In the code above, we have implemented a custom Spring Transaction Interceptor that extends the TransactionInterceptor
class provided by Spring. The custom interceptor overrides the "invokeWithinTransaction" method to manage transactions
around method invocations.

Specifically, the important points are:

1. When committing the transaction, we evaluate the result of the method invocation. If the method returns a Try type,
   we evaluate the Try failure and set the transaction status to roll back if necessary. Otherwise, we commit the
   transaction.
2. When an exception occurs, we roll back the transaction and return a Try failure if the method returns a Try type.
   Otherwise, we throw a RuntimeException containing the thrown exception.
3. We handle both standard transactions and callback preferring transactions. Callback preferring transactions are
   transactions that prefer a callback-based approach to executing the transaction.
4. We have implemented the `writeObject` and `readObject` methods to serialize and deserialize the custom interceptor.

## Example project

You can find the complete implementation of the custom Spring Transaction Interceptor along with an example on how to
use it
along with integration tests in the following GitHub
repository [spring-custom-transaction-interceptor](https://github.com/VassilisSoum/spring-custom-transaction-interceptor).

## Conclusion

In this article, we have implemented a custom Spring Transaction Interceptor that allows us to intercept the
transactional
behavior of our Spring Boot application. We have seen how we can use this interceptor to allow using the Try monad to
handle exceptions in a more functional way while retaining the transactional behavior of the @Transactional
annotation.

By learning how to implement a custom Spring Transaction Interceptor, you can combine the transactional behavior of
Spring with your specific use case requirements.

Happy coding and remember to subscribe to the newsletter to get the latest updates every week!

