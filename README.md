IndexedDB performance benchmark

- Measures with high-resolution [performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)
- Methods: set, get, getAll, bulkGet, indexed get, and readwrite mode
- Tests usage of large numbers of object stores vs large numbers of records
- Adjustable test params (total, limit, iterations)
- Easily toggle individual tests
- Modular db interface for adding and comparing other storage mediums (e.g. in-memory, localstorage, etc)

<img width="452" alt="image" src="https://github.com/raineorshine/indexeddb-benchmark/assets/750276/ebe08a0c-739e-4889-8afd-c9e07246ece0">

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
- readonly mode can be parallelized, but otherwise is no faster than readwrite
- **Chrome: `{ durability: relaxed }` significantly improves write performance**
- \*\*Safari: Large number of object stores results in massive slowdown of all methods
  - e.g. 1500 object stores causes a _single_ get to take ~100ms
  - Use [indexes](https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex) instead of object stores
