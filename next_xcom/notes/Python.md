# Python Notes (Basics → Intermediate → Advanced)

<!-- Format: one concept per bullet. Tweet from bullets only—never from this header. -->

---

## Basics: Variables & Types

- Python is dynamically typed. No type declarations. x = 5 then x = "hi" is fine.
- int has arbitrary precision—no overflow. 10**1000 works. Floats use IEEE 754.
- None is the null object. Use "is None" not "== None". Identity check.
- bool: 0, "", [], None are falsy. Everything else truthy. "and" and "or" short-circuit.
- Strings are immutable. s[0] = 'x' fails. Use slicing or build new string.
- f-strings: f"{name} is {age}". Fast, readable. Use f"{x:.2f}" for decimals.
- Triple quotes for multiline. ''' or """. Preserves newlines and indentation.

---

## Basics: Collections

- list is mutable, ordered. append, extend, insert, pop. Negative index = from end.
- tuple is immutable. Use for fixed data, dict keys, return values. (1,) not (1).
- dict: keys must be hashable (immutable). O(1) lookup. .get(key, default) avoids KeyError.
- set: unique, unordered, hashable. Fast membership. Union: |, intersection: &.
- List comp: [x*2 for x in nums if x>0]. Dict comp: {k: v for k,v in items}.
- Slicing: [start:stop:step]. [::-1] reverses. Stop is exclusive. Omitted = end.
- * unpacks iterables. ** unpacks dicts. def f(*args, **kwargs) for flexible args.

---

## Basics: Control Flow

- Indentation defines blocks. 4 spaces standard. No braces. Colon after if/for/def.
- for x in iterable. Use enumerate(iterable) for index. zip(a,b) pairs elements.
- else on loops: runs when loop completes without break. Handy for search loops.
- pass = no-op placeholder. Use when syntax requires a body but you have nothing.
- match/case (3.10+): pattern matching. match x: case 1: ... case _: default.
- Walrus := assigns and returns in one expression. while (line := f.readline()): ...

---

## Basics: Functions

- def name(params): ... Functions are first-class. Can assign, pass, return.
- Default args evaluated once at def time. Mutable default = shared object. Trap!
- *args collects extra positional args as tuple. **kwargs collects keyword args as dict.
- return without value returns None. Multiple values = tuple unpacking on call side.
- Lambda: single expression only. lambda x: x*2. No statements. Use def for complex.
- Scope: LEGB—Local, Enclosing, Global, Builtin. global/nonlocal to rebind outer.

---

## Intermediate: Modules & Imports

- import module or from module import name. Module = .py file. Package = folder with __init__.py.
- __name__ == "__main__" when run directly. Use for if __name__ == "__main__": main().
- sys.path lists import search dirs. PYTHONPATH env var adds dirs. Current dir first.
- from x import * pulls all. Avoid—pollutes namespace. Use __all__ to limit.
- importlib.reload(module) re-imports. Useful in REPL. Normal import caches.
- Relative import: from .sub import x. Dot = current package. Use in packages.

---

## Intermediate: OOP

- class Name: ... Methods take self as first param. __init__ is constructor.
- Inheritance: class Child(Parent): ... super() calls parent. MRO = method resolution order.
- @property turns method into attribute. Getter. @x.setter for setter. Encapsulation.
- __str__ for print/str. __repr__ for repr/debug. repr should be unambiguous.
- __eq__, __lt__, etc. for comparisons. Use functools.total_ordering for less boilerplate.
- __getitem__, __len__ make iterable. __iter__ and __next__ for iterator protocol.
- Duck typing: "if it walks like a duck..." No formal interfaces. Use protocols (typing).

---

## Intermediate: File I/O & Context

- open(path, mode). Modes: r, w, a, rb, wb. Always close or use with.
- with open(f) as f: ... Auto-closes on exit. Handles exceptions. Use always.
- Path: pathlib.Path. Path('x')/ 'y' joins. .read_text(), .write_text(). Cross-platform.
- json.load(f) and json.dump(obj, f). For dict/list. Custom encoder for objects.
- csv.reader, csv.DictReader. DictWriter for writing. Handles quoting.
- Encoding: open(f, encoding='utf-8'). Default varies by OS. Specify for portability.

---

## Intermediate: Exceptions

- try/except/else/finally. else runs if no exception. finally always runs.
- except Exception catches almost all. Be specific: except ValueError. Avoid bare except.
- raise ValueError("msg"). raise from e chains cause. Traceback shows both.
- Custom: class MyError(Exception): pass. Add attributes. Inherit for hierarchy.
- assert x, "msg". Fails if x falsy. -O disables asserts. Don't use for validation.
- traceback module: traceback.print_exc() for current exception. format_exc() for string.

---

## Advanced: Decorators

- Decorator = function that wraps another. @decorator above def. func = decorator(func).
- def dec(f): return wrapper. wrapper calls f. Return wrapper, not f().
- functools.wraps(f) preserves __name__, __doc__. Use in every decorator.
- @decorator(args) needs extra layer: def dec(*a): return lambda f: wrapper(f).
- Class decorators: receive class. Modify or return new. Metaclass alternative.
- @staticmethod, @classmethod. static = no self/cls. classmethod gets cls, for factories.

---

## Advanced: Generators & Iterators

- yield pauses function, returns value. Resumes on next(). Lazy evaluation.
- Generator = function with yield. Returns generator object. One-shot iteration.
- (x for x in nums) = generator expr. Lazy. [x for x in nums] = list comp, eager.
- next(it) gets next. StopIteration when done. for loop catches it.
- itertools: chain, cycle, islice, groupby. Lazy. Saves memory for big data.
- yield from subgen delegates. Flattens. async def uses await like yield.

---

## Advanced: Context Managers

- with block needs __enter__ and __exit__. __exit__ gets exception info. Return True to suppress.
- @contextmanager: yield instead of __enter__/__exit__. Code before yield = enter, after = exit.
- contextlib.ExitStack for dynamic with. Manages multiple contexts. Useful for optional resources.
- as f in with: f = result of __enter__. Yield value in @contextmanager.
- Suppressing exceptions: with contextlib.suppress(ValueError): risky_op()
- closing(obj) calls obj.close() on exit. For objects with close but no __enter__.

---

## Advanced: Async

- async def = coroutine. await pauses until result. Needs event loop.
- asyncio.run(main()) runs top-level. Replaces loop.run_until_complete.
- await only in async def. Sync code can't await. Use asyncio.create_task for fire-and-forget.
- asyncio.gather(*tasks) runs concurrently. Returns list of results. One fail = all fail by default.
- asyncio.to_thread(func, *args) runs sync func in thread pool. Avoid blocking loop.
- aiohttp for async HTTP. async with session.get(url) as r: ... Non-blocking I/O.

---

## Advanced: Type Hints

- def f(x: int) -> str: ... Annotations only. No runtime check. Use mypy.
- Optional[X] = X | None. Union[X,Y] or X | Y (3.10+). For nullable.
- list[int], dict[str, int]. Generic types. from __future__ import annotations for forward refs.
- TypeVar for generics. T = TypeVar('T'). def first(lst: list[T]) -> T:
- Protocol: structural typing. class X(Protocol): def method(self): ... Duck typing formalized.
- typing.overload for different signatures. Helps type checker. Runtime sees last def.

---

## Advanced: Data Classes & Beyond

- @dataclass auto-generates __init__, __repr__, __eq__. Less boilerplate.
- from dataclasses import dataclass. Fields with defaults after those without.
- dataclass(frozen=True) makes immutable. Good for hashable, thread-safe.
- __slots__ = ['a','b'] saves memory. No __dict__. Can't add attributes.
- __hash__: implement if __eq__ and want in set/dict key. Must be immutable.
- Named tuples: from collections import namedtuple. Point = namedtuple('Point','x y').

---

## Advanced: Metaclasses & Descriptors

- type(name, bases, dict) creates class. Metaclass = class of class. Rare.
- __new__ creates instance before __init__. Use for immutable, singletons.
- Descriptor: __get__, __set__, __delete__. property uses them. Reusable logic.
- __getattribute__ runs for every attribute access. Easy to break. Prefer __getattr__.
- ABC: from abc import ABC, abstractmethod. Abstract base class. Enforce interface.
- __subclasshook__ for structural subtyping. Customize isinstance/issubclass.

---

## Advanced: Packaging & Distribution

- pyproject.toml replaces setup.py. [build-system], [project]. Modern standard.
- pip install -e . for editable install. Code changes reflect without reinstall.
- venv: python -m venv .venv. Isolated env. Activate before pip install.
- __init__.py can be empty. Makes dir a package. __all__ = [...] for from pkg import *.
- -m runs module: python -m pytest. Puts cwd in path. Use for scripts.
- sys.argv for CLI args. argparse or click for real CLIs. Rich for pretty output.

---

## Python Gotchas

- Mutable default: def f(x=[]). Same list every call! Use def f(x=None): x = x or [].
- Late binding in closures: for i in range(3): funcs.append(lambda: i). All see 2. Bind i=i.
- is vs ==. is checks identity. Use for None, True, False. == checks value.
- Integer caching: small ints (-5 to 256) cached. a=1; b=1; a is b True. Don't rely.
- GIL: one thread runs Python bytecode at a time. Use multiprocessing for CPU-bound.
- import order matters. Circular imports break. Restructure or lazy import.

---

## CTA / Engagement Hooks

- What's your favorite Python gotcha?
- Decorators or context managers—which do you use more?
- How do you explain the GIL in one sentence?
- What Python feature surprised you most?
