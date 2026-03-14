# JavaScript Notes (Mid-Tier to Advanced)

<!-- Format: one concept per bullet. Tweet from bullets only—never from this header. -->

---

## Async & Promises

- async/await = sugar over Promises. Forgetting await in a loop runs parallel when you wanted sequential.
- Promise.all rejects on first failure. Promise.allSettled waits for all—use when one failure shouldn't kill the batch.
- Top-level await blocks your module. One slow fetch at the top can freeze the whole app load.
- Promise.race settles on first result. Race your promise vs setTimeout reject for timeouts.
- Microtasks run before macrotasks. setTimeout(fn,0) isn't immediate—Promises run first. Order matters.
- async always returns a Promise. Return 42? Caller gets Promise.resolve(42). Forgetting await = undefined.
- Unhandled rejections crash Node or fail silently. Always .catch() or try/catch. Add unhandledrejection in prod.

---

## Event Loop

- Microtasks drain fully before the next macrotask. That's why 100 Promises resolve before one setTimeout.
- Single-threaded = one call stack. Web Workers run on another thread—use for CPU-heavy work.
- requestAnimationFrame runs before repaint (~60fps). Use for animations; setTimeout for non-visual timing.
- Sync code blocks everything. No clicks, no scroll until stack clears. Chunk with setTimeout(0) or requestIdleCallback.

---

## Closures & Scope

- Closure = function that remembers its scope. var in a loop = classic trap. Use let or pass as param.
- Module pattern: IIFE + return public API. Closures give you private state without classes.
- Closures leak memory. Event listeners closing over DOM nodes? Remove them when done.
- TDZ: let/const exist but uninitialized until declaration. var is hoisted to undefined. Different.

---

## this Binding

- this is set at call time, not definition. Arrow functions inherit from enclosing scope—no own this.
- bind fixes this; call/apply invoke with given this. Use bind for event handlers.
- Class methods aren't auto-bound. Passing this.handleClick loses context. Bind in constructor or use arrow field.
- Nested functions: regular gets own this, arrow inherits. Hence arrow handlers in React class components.

---

## Prototype & Inheritance

- obj.method() looks up: obj → __proto__ → Object.prototype. That's prototypal inheritance.
- class is sugar over constructor + prototype. Still prototypes under the hood.
- Object.create(proto) = object delegating to proto. No constructor. Clean inheritance.
- hasOwnProperty = own keys. in = whole chain. for...in includes inherited—often use Object.keys().

---

## Modules (ESM vs CJS)

- ESM imports are static (parse time). CJS require is dynamic (runtime). No conditional import in ESM without dynamic import().
- ESM import = live binding. CJS = copy. Mutate export, all ESM importers see it.
- Dynamic import() returns a Promise. Use for code splitting. await import('./x.js') loads when needed.
- "Cannot use import outside module"—Node needs "type":"module" or .mjs. Browsers need type="module".

---

## Error Handling & Debugging

- try/catch only catches sync errors. Promise/async errors need await inside the try. Always await in try.
- Error boundaries catch render errors. Not event handlers or async—those need your try/catch.
- Custom errors: extend Error, super(message). Don't throw strings. Stack traces need real Error objects.
- console.trace() = call stack. console.time/timeEnd = perf. debugger = pause in DevTools. Remove before commit.

---

## Performance & Patterns

- Debounce: wait until user stops (typing/clicking). Throttle: max once per X ms. Search = debounce, scroll = throttle.
- Memoization caches results by input. useMemo/useCallback = re-render avoidance, not general memoization.
- WeakMap/WeakSet = weak refs. Key can be GC'd. Use for DOM metadata without leaks.
- Shallow copy: {...obj} or [...arr]. Deep clone: structuredClone (modern) or a library.

---

## Modern JS Gotchas

- ?. short-circuits to undefined. ?? only falls back for null/undefined—0 and "" stay. || replaces those too.
- == coerces; === doesn't. 0==false is true; 0===false is false. Prefer ===.
- NaN === NaN is false. Use Number.isNaN(x). typeof NaN is "number". Quirk.
- map returns new array; forEach returns undefined. filter keeps truthy. reduce = Swiss Army knife—loop sometimes clearer.
- Symbol = unique primitive. Use for non-colliding keys. Symbol.iterator powers for...of.

---

## CTA / Engagement Hooks

- What's your go-to async debugging trick?
- Debounce or throttle for scroll—which first?
- How do you explain the event loop in one sentence?
- What JS gotcha bit you in production?
