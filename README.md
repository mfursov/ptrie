# Lightweight Path Trie for TypeScript and JavaScript

Path trie uses a path (array of tokens) as an index and provides fast insertion, lookup, deletion and iteration operations based
on the paths and path prefixes.

Path trie can be used to store and manipulate hierarchical structures (objects, records).

The package has no external dependencies and is available under Apache License Version 2.0.

## Usage examples

#### Get, set and delete by path. Deletion of the parent path value deletes child subtree.

```typescript
import {Trie} from 'ptrie';

// Build data hierarchy.
const trie = new Trie<string, unknown>();
const org1Path = ['organization-id-1'];
const user1Path = ['organization-id-1', 'users', 'user-id-1'];
const user2Path = ['organization-id-1', 'users', 'user-id-2'];
trie.set(org1Path, organization1Info);
trie.set(user1Path, user1Info);
trie.set(user1Path, user2Info);

// Query it by path.
expect(trie.get(user1Path)).toBe(user1Info);
expect(trie.count(['organization-id-1', 'users'])).toBe(2);

// Iterate a sub-tree.
trie.visitDfs('pre-order', value => console.log('User', value), ['organization-id-1', 'users']);

// Delete a parent node (by path prefix) to delete the whole sub-tree.
expect(trie.delete(org1Path));
expect(trie.get(org1Path)).toBeUndefined();
expect(trie.get(user1Path)).toBeUndefined();
expect(trie.get(user2Path)).toBeUndefined();
```

See [documentation](https://github.com/mfursov/ptrie/tree/master/src/Trie.ts)
for each available method in the source code and usage examples
in [unit tests](https://github.com/mfursov/ptrie/tree/master/tests/Trie.jest.ts).
