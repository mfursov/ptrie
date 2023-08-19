import {beforeEach, describe, expect, it} from '@jest/globals';
import {Trie, TriePathValueProvider, TrieVisitor} from '../src/Trie';

interface Obj {
    field: string;
}

const obj1: Obj = {field: 'f1'};
const obj2: Obj = {field: 'f2'};

describe('Trie', () => {
    let stringNumTrie = new Trie<string, number>();
    let numObjTrie = new Trie<number, Obj>();

    beforeEach(() => {
        stringNumTrie = new Trie();
        numObjTrie = new Trie();
    });

    describe('constructor', () => {
        it('creates an empty trie', () => {
            const trie = new Trie();
            expect(trie.get([])).toBe(undefined);
        });
    });

    describe('get', () => {
        it('works for an empty path', () => {
            expect(numObjTrie.get([])).toBe(undefined);
            numObjTrie.set([], obj1);
            expect(numObjTrie.get([])).toBe(obj1);
            numObjTrie.set([1], obj2);
            expect(numObjTrie.get([])).toBe(obj1);
        });

        it('works with a top level field', () => {
            expect(numObjTrie.get([])).toBe(undefined);
            numObjTrie.set([1], obj1);
            numObjTrie.set([1, 2], obj2);
            expect(numObjTrie.get([])).toBe(undefined);
            expect(numObjTrie.get([1])).toBe(obj1);
            expect(numObjTrie.get([2])).toBe(undefined);
            expect(numObjTrie.get([1, 2])).toBe(obj2);
        });

        it('works with a deep field', () => {
            const path = [0, 1, 2, 3, 4, 5, 6, 7];
            numObjTrie.set(path, obj2);
            const prefixPath: number[] = [];
            for (let i = 0; i < path.length; i++) {
                expect(numObjTrie.get(prefixPath)).toBe(undefined);
                prefixPath.push(i);
            }
            expect(numObjTrie.get(path)).toBe(obj2);
        });
    });

    describe('getOrSet', () => {
        it('calls dataProvider once', () => {
            let providerCallCount = 0;
            const result = stringNumTrie.getOrSet(['p1', 'p2'], () => {
                providerCallCount++;
                return 10;
            });
            expect(providerCallCount).toBe(1);
            expect(result).toBe(10);

            expect(stringNumTrie.get(['p1', 'p2'])).toBe(10);
            expect(stringNumTrie.get(['p1'])).toBe(undefined);
            expect(stringNumTrie.get([])).toBe(undefined);
        });

        it('can be used with root node', () => {
            const result = stringNumTrie.getOrSet([], () => 10);
            expect(result).toBe(10);
            expect(stringNumTrie.get([])).toBe(10);
            const rootNode = stringNumTrie.getNode([]);
            expect(rootNode).toBeDefined();
            expect(rootNode?.children?.size).toBe(0);
        });

        it('does not call provider for an existing node', () => {
            const result1 = stringNumTrie.getOrSet(['1'], () => 10);
            const result2 = stringNumTrie.getOrSet(['1'], () => 20);
            expect(result1).toBe(10);
            expect(result2).toBe(10);
            expect(stringNumTrie.get(['1'])).toBe(10);
            expect(stringNumTrie.getNode([])?.children?.size).toBe(1);
        });

        it('supports null as a values', () => {
            const trie = new Trie<string, null>();
            const result1 = trie.getOrSet(['1'], () => null);
            expect(result1).toBe(null);
        });

        it('does not fail on undefined values', () => {
            const trie = new Trie<string, undefined>();
            const result1 = trie.getOrSet(['1'], () => undefined);
            expect(result1).toBe(undefined);
            expect(trie.get(['1'])).toBe(undefined);
            expect(trie.getNode(['1'])).toBe(undefined);
            expect(trie.getNode([])).toBeDefined();
            expect(trie.getNode([])?.children.size).toBe(0);
            expect(trie.getNode([])?.parent).toBe(undefined);
        });

        it('does not remove children when parent is set to undefined', () => {
            const trie = new Trie<string, boolean | undefined>();
            trie.getOrSet(['1', '2'], () => true);
            expect(trie.get(['1', '2'])).toBe(true);
            trie.getOrSet(['1'], () => undefined);
            expect(trie.get(['1'])).toBe(undefined);
            expect(trie.get(['1', '2'])).toBe(true);
            expect(trie.getNode(['1'])?.children.size).toBe(1);
            expect(trie.getNode(['1'])?.parent).toBe(trie.getNode([]));
        });
    });

    describe('set', () => {
        it('sets a value to root node', () => {
            expect(stringNumTrie.get([])).toBe(undefined);
            stringNumTrie.set([], 1);
            expect(stringNumTrie.get([])).toBe(1);
            expect(stringNumTrie.getNode([])?.children.size).toBe(0);
            stringNumTrie.set([], 2);
            expect(stringNumTrie.get([])).toBe(2);
            stringNumTrie.set([], undefined);
            expect(stringNumTrie.get([])).toBe(undefined);
            expect(stringNumTrie.getNode([])).toBeDefined();
        });

        it('sets a value to a child node', () => {
            stringNumTrie.set(['a'], 1);
            expect(stringNumTrie.get(['a'])).toBe(1);
            expect(stringNumTrie.get([])).toBe(undefined);

            const rootNode = stringNumTrie.getNode([]);
            const childNode = stringNumTrie.getNode(['a']);
            expect(rootNode?.children.size).toBe(1);
            expect(rootNode?.children.values()).toContain(childNode);
            expect(childNode?.children.size).toBe(0);
            expect(childNode?.parent).toBe(rootNode);
        });

        it('overwrites the value', () => {
            stringNumTrie.set(['a'], 1);
            stringNumTrie.set(['a'], 2);
            expect(stringNumTrie.get(['a'])).toBe(2);
        });

        it('setting undefined deletes a node with no children', () => {
            stringNumTrie.set(['a'], 1);
            stringNumTrie.set(['a'], undefined);
            expect(stringNumTrie.get(['a'])).toBe(undefined);
            expect(stringNumTrie.getNode(['a'])).toBe(undefined);
        });

        it('setting undefined does not deletes a node with children', () => {
            stringNumTrie.set(['a'], 1);
            stringNumTrie.set(['a', 'b'], 2);
            stringNumTrie.set(['a'], undefined);
            expect(stringNumTrie.get(['a'])).toBeUndefined();
            expect(stringNumTrie.get(['a', 'b'])).toBe(2);
            expect(stringNumTrie.getNode(['a', 'b'])?.parent).toBe(stringNumTrie.getNode(['a']));
        });

        it('setting null does not deletes the node', () => {
            const nullValueTrie = new Trie<string, null>();
            nullValueTrie.set(['a'], null);
            expect(nullValueTrie.get(['a'])).toBe(null);
            expect(nullValueTrie.getNode(['a'])).toBeDefined();
        });

        it('setting undefined deletes an undefined non-root parent node', () => {
            stringNumTrie.set(['a', 'b'], 1);
            expect(stringNumTrie.get([])).toBe(undefined);
            expect(stringNumTrie.get(['a'])).toBe(undefined);
            expect(stringNumTrie.get(['a', 'b'])).toBe(1);
            expect(stringNumTrie.getNode(['a'])?.parent).toBe(stringNumTrie.getNode([]));
            expect(stringNumTrie.getNode(['a', 'b'])?.parent).toBe(stringNumTrie.getNode(['a']));

            stringNumTrie.set(['a', 'b'], undefined);
            expect(stringNumTrie.getNode([])).toBeDefined();
            expect(stringNumTrie.getNode([])?.children.size).toBe(0);
            expect(stringNumTrie.getNode(['a'])).toBeUndefined();
            expect(stringNumTrie.getNode(['a', 'b'])).toBeUndefined();
        });
    });

    describe('delete', () => {
        it('deletes value as expected', () => {
            numObjTrie.set([1], obj1);
            expect(numObjTrie.get([])).toBe(undefined);
            expect(numObjTrie.get([1])).toBe(obj1);

            numObjTrie.delete([1]);
            expect(numObjTrie.get([])).toBe(undefined);
            expect(numObjTrie.get([1])).toBe(undefined);
            expect(numObjTrie.getNode([1])).toBe(undefined);
        });

        it(`delete on root node clears root node value`, () => {
            numObjTrie.set([], obj1);
            numObjTrie.delete([]);
            expect(numObjTrie.get([])).toBeUndefined();
            expect(numObjTrie.getNode([])).toBeDefined();
        });

        it(`delete on root node deletes children`, () => {
            numObjTrie.set([1], obj1);
            numObjTrie.delete([]);
            expect(numObjTrie.get([1])).toBeUndefined();
            expect(numObjTrie.getNode([1])).toBeUndefined();
        });

        it(`delete on a parent deletes children`, () => {
            numObjTrie.set([1, 2], obj1);
            numObjTrie.delete([1]);
            expect(numObjTrie.get([1])).toBeUndefined();
            expect(numObjTrie.get([1, 2])).toBeUndefined();
            expect(numObjTrie.getNode([1])).toBeUndefined();
            expect(numObjTrie.getNode([1, 2])).toBeUndefined();
        });

        it('deletes an undefined non-root parent node', () => {
            stringNumTrie.set(['a', 'b'], 2);
            expect(stringNumTrie.get([])).toBe(undefined);
            expect(stringNumTrie.get(['a'])).toBe(undefined);
            expect(stringNumTrie.get(['a', 'b'])).toBe(2);

            stringNumTrie.delete(['a', 'b']);
            expect(stringNumTrie.getNode([])?.children.size).toBe(0);
            expect(stringNumTrie.get(['a'])).toBeUndefined();
            expect(stringNumTrie.getNode(['a'])).toBeUndefined();
            expect(stringNumTrie.get(['a', 'b'])).toBeUndefined();
            expect(stringNumTrie.getNode(['a', 'b'])).toBeUndefined();
        });
    });

    describe('count', () => {
        it('returns expected size', () => {
            expect(numObjTrie.count()).toBe(0);

            numObjTrie.set([], obj1);
            expect(numObjTrie.count()).toBe(1);

            numObjTrie.set([1], obj2);
            expect(numObjTrie.count()).toBe(2);
            numObjTrie.set([1, 2], obj2);
            expect(numObjTrie.count()).toBe(3);

            numObjTrie.set([1], undefined);
            expect(numObjTrie.count()).toBe(2);

            numObjTrie.set([], undefined);
            expect(numObjTrie.count()).toBe(1);

            numObjTrie.set([1, 2], undefined);
            expect(numObjTrie.count()).toBe(0);
        });

        it('works on sub-path', () => {
            numObjTrie.set([], obj1);
            numObjTrie.set([1], obj2);
            numObjTrie.set([1, 2], obj1);
            expect(numObjTrie.count([1])).toBe(2);
            expect(numObjTrie.count([1, 2])).toBe(1);
            expect(numObjTrie.count([1, 2, 3])).toBe(0);
        });

        it('set undefined to undefined does not increase count', () => {
            expect(numObjTrie.count()).toBe(0);
            numObjTrie.set([1], undefined);
            expect(numObjTrie.count()).toBe(0);
        });

        it('set defined to defined does not increase count', () => {
            numObjTrie.set([1], obj1);
            expect(numObjTrie.count()).toBe(1);

            numObjTrie.set([1], obj2);
            expect(numObjTrie.count()).toBe(1);
        });

        it('set defined to undefined does increases count', () => {
            expect(numObjTrie.count()).toBe(0);
            numObjTrie.set([1], obj1);
            expect(numObjTrie.count()).toBe(1);
        });

        it('set undefined to defined decreases count', () => {
            numObjTrie.set([1], obj1);
            expect(numObjTrie.count()).toBe(1);
            numObjTrie.set([1], undefined);
            expect(numObjTrie.count()).toBe(0);
        });
    });

    describe('isEmpty', () => {
        it('works as expected', () => {
            expect(numObjTrie.isEmpty).toBe(true);

            numObjTrie.set([], obj1);
            expect(numObjTrie.isEmpty).toBe(false);

            numObjTrie.delete([]);
            expect(numObjTrie.isEmpty).toBe(true);

            numObjTrie.set([1], obj2);
            expect(numObjTrie.isEmpty).toBe(false);

            numObjTrie.set([1], undefined);
            expect(numObjTrie.isEmpty).toBe(true);
        });
    });

    describe('fillPath', () => {
        const paths: Array<string[]> = [];
        const oldValues: Array<number | undefined> = [];
        let nValuesToProvide = -1;
        const pathValueProvider: TriePathValueProvider<string, number> = (value, path) => {
            paths.push([...path]);
            oldValues.push(value);
            return nValuesToProvide >= 0 && oldValues.length > nValuesToProvide ? Trie.StopFillToken : path.length;
        };

        beforeEach(() => {
            paths.length = 0;
            oldValues.length = 0;
            nValuesToProvide = -1;
        });

        it('can fill root node', () => {
            stringNumTrie.fillPath([], pathValueProvider);
            expect(stringNumTrie.count()).toBe(1);
            expect(stringNumTrie.get([])).toBe(0);
            expect(paths).toEqual([[]]);
            expect(oldValues).toEqual([undefined]);
        });

        it('can fill root node with undefined', () => {
            stringNumTrie.fillPath([], () => undefined);
            expect(stringNumTrie.count()).toBe(0);
            expect(stringNumTrie.get([])).toBe(undefined);
        });

        it('can fill a deep true', () => {
            stringNumTrie.fillPath(['1', '2', '3'], pathValueProvider);
            expect(stringNumTrie.count()).toBe(4);
            expect(stringNumTrie.get([])).toBe(0);
            expect(stringNumTrie.get(['1'])).toBe(1);
            expect(stringNumTrie.get(['1', '2'])).toBe(2);
            expect(stringNumTrie.get(['1', '2', '3'])).toBe(3);
        });

        it('stops when Trie.StopFillToken is returned', () => {
            nValuesToProvide = 2;
            stringNumTrie.fillPath(['1', '2', '3'], pathValueProvider);
            expect(stringNumTrie.count()).toBe(2);
            expect(stringNumTrie.get([])).toBe(0);
            expect(stringNumTrie.get(['1'])).toBe(1);
            expect(stringNumTrie.get(['1', '2'])).toBe(undefined);
            expect(stringNumTrie.get(['1', '2', '3'])).toBe(undefined);
        });

        it('passes correct current values', () => {
            stringNumTrie.set([], 10);
            stringNumTrie.set(['1'], 11);
            stringNumTrie.set(['1', '2', '3'], 13);
            expect(stringNumTrie.count()).toBe(3);

            stringNumTrie.fillPath(['1', '2', '3'], pathValueProvider);
            expect(oldValues).toEqual([10, 11, undefined, 13]);
            expect(stringNumTrie.count()).toBe(4);
            expect(stringNumTrie.get([])).toBe(0);
            expect(stringNumTrie.get(['1'])).toBe(1);
            expect(stringNumTrie.get(['1', '2'])).toBe(2);
            expect(stringNumTrie.get(['1', '2', '3'])).toBe(3);
        });
    });

    describe('visitDfs', () => {
        const paths: Array<string[]> = [];
        const values: Array<number | undefined> = [];
        let stopOnCount = -1;
        const testVisitor: TrieVisitor<string, number> = (value, path) => {
            paths.push([...path]);
            values.push(value);
            if (stopOnCount >= 0 && values.length === stopOnCount) {
                return false;
            }
        };

        function buildDfsTestTrie(): void {
            stringNumTrie.set([], 0);
            stringNumTrie.set(['1'], 1);
            stringNumTrie.set(['2'], 2);
            stringNumTrie.set(['1', '11'], 11);
            stringNumTrie.set(['1', '12'], 12);
            stringNumTrie.set(['2', '21'], 21);
            stringNumTrie.set(['2', '22'], 22);
        }

        beforeEach(() => {
            paths.length = 0;
            values.length = 0;
            stopOnCount = -1;
        });

        describe(('pre-order'), () => {
            it('a root without a value is reported', () => {
                stringNumTrie.visitDfs('pre-order', testVisitor);
                expect(paths.length).toBe(1);
                expect(paths).toEqual([[]]);
                expect(values).toEqual([undefined]);
            });

            it('a root with a value is reported', () => {
                stringNumTrie.set([], 1);
                stringNumTrie.visitDfs('pre-order', testVisitor);
                expect(paths.length).toBe(1);
                expect(paths).toEqual([[]]);
                expect(values).toEqual([1]);
            });

            it('nodes with undefined values are reported', () => {
                stringNumTrie.set(['a', 'b'], 1);
                stringNumTrie.visitDfs('pre-order', testVisitor);
                expect(paths.length).toBe(3);
                expect(paths).toEqual([[], ['a'], ['a', 'b']]);
                expect(values).toEqual([undefined, undefined, 1]);
            });

            it('uses DFS pre-order', () => {
                buildDfsTestTrie();
                stringNumTrie.visitDfs('pre-order', testVisitor);

                expect(paths.length).toBe(7);
                expect(paths).toEqual([[], ['1'], ['1', '11'], ['1', '12'], ['2'], ['2', '21'], ['2', '22']]);
                expect(values).toEqual([0, 1, 11, 12, 2, 21, 22]);
            });

            it('uses subtreeRootPath in DFS pre-order ', () => {
                buildDfsTestTrie();
                stringNumTrie.visitDfs('pre-order', testVisitor, ['1']);
                expect(paths.length).toBe(3);
                expect(paths).toEqual([['1'], ['1', '11'], ['1', '12']]);
                expect(values).toEqual([1, 11, 12]);
            });

            it('stops when visitor returns false', () => {
                stopOnCount = 3;
                stringNumTrie.set(['a', 'b'], 1);
                stringNumTrie.set(['a', 'b', 'c'], 2);
                stringNumTrie.visitDfs('pre-order', testVisitor);
                expect(paths.length).toBe(3);
                expect(paths).toEqual([[], ['a'], ['a', 'b']]);
                expect(values).toEqual([undefined, undefined, 1]);
            });
        });

        describe(('in-order'), () => {
            it('a root without a value is reported', () => {
                stringNumTrie.visitDfs('in-order', testVisitor);
                expect(paths.length).toBe(1);
                expect(paths).toEqual([[]]);
                expect(values).toEqual([undefined]);
            });

            it('a root with a value is reported', () => {
                stringNumTrie.set([], 1);
                stringNumTrie.visitDfs('in-order', testVisitor);
                expect(paths.length).toBe(1);
                expect(paths).toEqual([[]]);
                expect(values).toEqual([1]);
            });

            it('nodes with undefined values are reported', () => {
                stringNumTrie.set(['a', 'b'], 1);
                stringNumTrie.visitDfs('in-order', testVisitor);
                expect(paths.length).toBe(3);
                expect(paths).toEqual([['a', 'b'], ['a'], [],]);
                expect(values).toEqual([1, undefined, undefined]);
            });

            it('uses DFS in-order', () => {
                buildDfsTestTrie();
                stringNumTrie.visitDfs('in-order', testVisitor);

                expect(paths.length).toBe(7);
                expect(paths).toEqual([['1', '11'], ['1', '12'], ['1'], ['2', '21'], ['2', '22'], ['2'], []]);
                expect(values).toEqual([11, 12, 1, 21, 22, 2, 0]);
            });

            it('uses subtreeRootPath in DFS in-order ', () => {
                buildDfsTestTrie();
                stringNumTrie.visitDfs('in-order', testVisitor, ['2']);
                expect(paths.length).toBe(3);
                expect(paths).toEqual([['2', '21'], ['2', '22'], ['2']]);
                expect(values).toEqual([21, 22, 2]);
            });

            it('stops when visitor returns false', () => {
                stopOnCount = 3;
                stringNumTrie.set(['a', 'b'], 1);
                stringNumTrie.set(['a', 'b', 'c'], 2);
                stringNumTrie.visitDfs('in-order', testVisitor);
                expect(paths.length).toBe(3);
                expect(paths).toEqual([['a', 'b', 'c'], ['a', 'b'], ['a']]);
                expect(values).toEqual([2, 1, undefined]);
            });
        });
    });
});

