/** Node in Trie. */
export interface TrieNode<Key, Value> {
    /**
     * Value assigned to the node.
     * Note: trie does not keep subtrees of nodes with `undefined` data: these subtrees are auto-removed.
     */
    value?: Value;

    /** Parent node. Undefined for the root node. */
    parent?: TrieNode<Key, Value>;

    /** Child nodes of the node. */
    children: Map<Key, TrieNode<Key, Value>>;

    /** Count of children with a value set. */
    childrenWithValue: number;
}

/**
 * Value provider for `Trie.getOrSet`.
 * Called only for the missed (undefined) value.
 */
export type TrieNodeValueProvider<Key, Value> = (path: ReadonlyArray<Key>) => Value;

/**
 * Value provider for `Trie.fillPath`.
 * Called on all values in the path and must return either a new value or a stop token.
 * When the stop token is returned, the `Trie.fillPath` function stops.
 */
export type TriePathValueProvider<Key, Value> = (currentValue: Value | undefined, path: ReadonlyArray<Key>) => Value | undefined | typeof Trie.StopFillToken;

/**
 * Trie visitor for `Trie.visitDfs`.
 * Called for every node in the tree in depth first order.
 * The iteration stops if the visitor returns 'false'.
 */
export type TrieVisitor<Key, Value> = (value: Value | undefined, path: ReadonlyArray<Key>) => void | false;

/**
 * A trie with every node has an assigned value of type `Value` or undefined.
 * The trie is optimized to keep in memory subtrees of nodes with at least one node having a non-undefined value.
 */
export class Trie<Key = string | number | boolean | bigint, Value = unknown> {
    /** Root node of the trie. This is an internal node that is never removed. */
    private readonly root: TrieNode<Key, Value> = {children: new Map(), childrenWithValue: 0};

    /** Returns a value stored under the given path. */
    get(path: ReadonlyArray<Key>): Value | undefined {
        return this.getNode(path)?.value;
    }

    /**
     * Returns a value assigned to the path.
     * If there is no node found of the node value is `undefined`,
     * the method calls the provider for the new value.
     */
    getOrSet(path: ReadonlyArray<Key>, valueProvider: TrieNodeValueProvider<Key, Value>): Value {
        const node = this._buildPath(path);
        if (node.value !== undefined) {
            return node.value;
        }
        const newValue = valueProvider(path);
        this._setNodeValue(node, newValue, newValue === undefined);
        return newValue;
    }

    /** Sets node value. */
    set(path: ReadonlyArray<Key>, value: Value | undefined): void {
        const node = value === undefined ? this._findNode(path) : this._buildPath(path);
        if (node) {
            this._setNodeValue(node, value, true);
        }
    }

    /** Removes the node under the path and all its children from the tree. */
    delete(path: ReadonlyArray<Key>): void {
        const node = this._findNode(path);
        if (node === undefined) {
            return;
        }
        if (node.parent === undefined) {
            if (node !== this.root) {
                throw new Error('Only root node can have no parent.');
            }
            this.root.value = undefined;
            this.root.children.clear();
            this.root.childrenWithValue = 0;
            return;
        }
        const delta = (node.value === undefined ? 0 : 1) + node.childrenWithValue;
        if (delta > 0) {
            this._updateChildrenWithValue(node, -delta);
        }
        node.parent.children.delete(path[path.length - 1]);
        this._runGc(node.parent);
    }

    /** Clears the trie: remove all nodes from the trie. */
    clear(): void {
        this.delete([]);
    }

    /**
     * Returns a count of all child nodes (any depth) with non-undefined
     * values under the `path` including the node pointed by the path if `mode` is `node-and-children`.
     *
     * A call with no arguments will return a total count of all values in the trie.
     */
    count(path: Array<Key> = [], mode: 'node-and-children' | 'children-only' = 'node-and-children'): number {
        const node = this.getNode(path);
        if (node === undefined) {
            return 0;
        }
        return node.childrenWithValue + (mode === 'node-and-children' && node.value !== undefined ? 1 : 0);
    }

    /** Returns true if the trie has no nodes with non-undefined values. */
    get isEmpty(): boolean {
        return this.count() === 0;
    }

    /** Stop token value for the `TriePathValueProvider` and `Trie.fillPath`. */
    static readonly StopFillToken = Symbol('Trie.StopFillToken');

    /**
     * Fills a path with a values provided by the `TriePathValueProvider`.
     * The fill is started from the top level path elements.
     * The `provider` is called for every element in the path.
     * The fill operation stops if `provider` returns Trie.StopFillToken.
     */
    fillPath(path: ReadonlyArray<Key>, valueProvider: TriePathValueProvider<Key, Value>): void {
        const currentPath: Key[] = [];
        let node = this.root;
        let newValue = valueProvider(node.value, currentPath);
        if (newValue === Trie.StopFillToken) {
            return;
        }
        this._setNodeValue(node, newValue, false);

        for (let i = 0; i < path.length; i++) {
            const key = path[i];
            currentPath.push(key);
            let child = node.children.get(key);
            newValue = valueProvider(child?.value, currentPath);
            if (newValue === Trie.StopFillToken) {
                break;
            }
            if (!child) {
                child = {children: new Map(), parent: node, childrenWithValue: 0};
                node.children.set(key, child);
            }
            this._setNodeValue(child, newValue, false);
            node = child;
        }
        this._runGc(node);
    }

    /**
     * Visits the tree in a DFS order.
     * Starts with a `subtreeRootPath` node.
     * All nodes are reported: even with an undefined value.
     * If the callback returns false, it will not iterate into the children of the current node.
     */
    visitDfs(order: 'in-order' | 'pre-order', visitorFn: TrieVisitor<Key, Value>, subtreeRootPath: Array<Key> = []): void {
        const node = this.getNode(subtreeRootPath);
        if (node === undefined) {
            return;
        }
        this._visitDfs(order, node, visitorFn, [...subtreeRootPath]);
    }

    private _visitDfs(order: 'in-order' | 'pre-order', node: TrieNode<Key, Value>, visitor: TrieVisitor<Key, Value>, path: Array<Key>): boolean {
        if (order === 'pre-order') {
            if (visitor(node.value, path) === false) {
                return false;
            }
        }
        for (const [childKey, childNode] of node.children) {
            path.push(childKey);
            if (!this._visitDfs(order, childNode, visitor, path)) {
                return false;
            }
            path.pop();
        }
        if (order === 'in-order') {
            if (visitor(node.value, path) === false) {
                return false;
            }
        }
        return true;
    }

    /**
     * Returns a node by the given path.
     * This method is not designed to be a part of the public API because it exposes internal trie details.
     * It exists for testing only.
     * Use with care: trie guarantees a consistent TrieNode hierarchy only at the moment of the method call
     * and may replace/remove nodes as the result of any other method call.
     */
    getNode(path: ReadonlyArray<Key>): Readonly<TrieNode<Key, Value>> | undefined {
        return this._getNode(path);
    }

    private _getNode(path: ReadonlyArray<Key>): TrieNode<Key, Value> | undefined {
        let node: TrieNode<Key, Value> | undefined = this.root;
        for (const key of path) {
            node = node.children.get(key);
            if (!node) {
                return undefined;
            }
        }
        return node;
    }

    /** Finds a node with the given path. */
    private _findNode(path: ReadonlyArray<Key>): TrieNode<Key, Value> | undefined {
        let node: TrieNode<Key, Value> | undefined = this.root;
        for (let i = 0; i < path.length && node; i++) {
            node = node.children.get(path[i]);
        }
        return node;
    }

    /**
     * Creates a path with new nodes holding `undefined` value.
     * Reuses current nodes if found.
     */
    private _buildPath(path: ReadonlyArray<Key>): TrieNode<Key, Value> {
        let node = this.root;
        for (let i = 0; i < path.length; i++) {
            const key = path[i];
            let child = node.children.get(key);
            if (!child) {
                child = {children: new Map(), parent: node, childrenWithValue: 0};
                node.children.set(key, child);
            }
            node = child;
        }
        return node;
    }

    /** Updates node value and `childrenWithValue` counter. Does not clean up the tree. */
    private _setNodeValue(node: TrieNode<Key, Value>, newValue: Value | undefined, runGc: boolean): void {
        if (node.value !== newValue) {
            const delta = newValue === undefined ? -1 : node.value === undefined ? 1 : 0;
            node.value = newValue;
            this._updateChildrenWithValue(node, delta);
        }
        if (runGc) {
            this._runGc(node);
        }
    }

    /** Updates all parent nodes of the node: adds `delta` to their `childrenWithValue` field. */
    private _updateChildrenWithValue(node: TrieNode<Key, Value>, delta: number): void {
        if (delta === 0) {
            return;
        }
        for (let parent: TrieNode<Key, Value> | undefined = node.parent; parent; parent = parent.parent) {
            parent.childrenWithValue += delta;
            if (parent.childrenWithValue < 0) {
                throw new Error('Internal error: negative counter value!');
            }
        }
    }

    /**
     *  Cleanups the trie starting from the current node.
     *  Runs the cleanup only if `node.value` is undefined.
     */
    private _runGc(node: TrieNode<Key, Value>): void {
        if (node.value !== undefined) {
            return;
        }
        if (node.childrenWithValue === 0) {
            node.children.clear();
        }
        if (node.parent) {
            this._runGc(node.parent);
        }
    }
}
