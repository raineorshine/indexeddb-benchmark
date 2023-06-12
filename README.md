# IndexedDB performance benchmark

A suite of benchmarks that can be run in your browser to assess IndexedDB performance.

- Measures with high-resolution [performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)
- Tests set, get, getAll, bulkGet, indexed get, and readwrite mode
- Tests large numbers of object stores vs large numbers of records
- Adjustable test params (total, limit, iterations)
- Easily toggle individual tests
- Modular db interface for adding and comparing other storage mediums (e.g. in-memory, localstorage, etc)

<img width="514" alt="image" src="https://github.com/raineorshine/indexeddb-benchmark/assets/750276/ab0ce51d-42b4-45c9-b7e8-2dd2622d98ab">

# Install

```
npm install
```

# Usage

Run the development server:

```
npm start
```

# Conclusions

- indexes are fast
- bulkGet scales well
- **Chrome: `{ durability: 'relaxed' }` significantly improves write performance**
- **Safari: Large number of object stores results in massive slowdown of all methods**
  - e.g. 1500 object stores causes a _single_ get to take ~100ms
  - Use [indexes](https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex) instead of object stores
