"""Print the first 20 Fibonacci numbers.

Algorithm: iterative pair-swapping. The Fibonacci sequence is defined by
F(0) = 0, F(1) = 1, and F(n) = F(n-1) + F(n-2) for n >= 2. Rather than
using recursion (which recomputes the same subproblems exponentially),
this keeps just the two most recent values in variables `a` and `b`.
Each loop iteration prints the current number, then advances the pair:
`a` takes `b`'s value and `b` becomes the sum `a + b` — computed
simultaneously via tuple assignment so the old `a` is used in the sum.
This runs in O(n) time and O(1) space for n numbers.
"""


def fibonacci(count):
    """Yield the first `count` Fibonacci numbers, starting from 0."""
    a, b = 0, 1
    for _ in range(count):
        yield a
        a, b = b, a + b


if __name__ == "__main__":
    for number in fibonacci(20):
        print(number)
