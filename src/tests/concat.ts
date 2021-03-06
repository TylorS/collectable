import {assert} from 'chai';
import {append, createArray} from '../collectable/list/values';
import {List} from '../collectable/list';
import {ListState} from '../collectable/list/state';
import {Slot} from '../collectable/list/slot';
import {concat, join} from '../collectable/list/concat';
import {compact} from '../collectable/list/compact';

import {
  BRANCH_FACTOR,
  BRANCH_INDEX_BITCOUNT,
  gatherLeafValues,
  makeStandardSlot,
  makeRelaxedSlot,
  rootSlot,
  makeValues
} from './test-utils';


var large = BRANCH_FACTOR << BRANCH_INDEX_BITCOUNT;
var small = BRANCH_FACTOR;

function copySum(src: Slot<string>, srcidx: number, dest: Slot<string>, destidx: number): void {
  (<Slot<string>>dest.slots[destidx]).sum = (<Slot<string>>src.slots[srcidx]).sum;
}

function makeJoinablePair(height: number, subtractLeftSize = 0, subtractRightSize = 0): [Slot<string>, Slot<string>] {
  var level = height - 1;
  var left = makeStandardSlot((((BRANCH_FACTOR >>> 1) - 1) << (level*BRANCH_INDEX_BITCOUNT)) - subtractLeftSize, level, 0);
  var right = makeStandardSlot(((BRANCH_FACTOR >>> 1) << (level*BRANCH_INDEX_BITCOUNT)) - subtractRightSize, level, left.size);
  return [left, right];
}

suite('[List: concatenation]', () => {
  suite('compact()', () => {
    test('child slots are moved from right to left until the slot distribution is balanced', () => {
      function makeRelaxedPair(): [Slot<string>, Slot<string>] {
        var leftSlots: Slot<string>[] = [], rightSlots: Slot<string>[] = [];
        const level = 1;
        for(var i = 0, offset = 0; i < BRANCH_FACTOR; i++) {
          var size = (i === BRANCH_FACTOR - 4 || i === BRANCH_FACTOR - 3) ? small : large;
          leftSlots.push(makeStandardSlot(size, level, offset));
          offset += size;
        }
        for(i = 0; i < 4; i++) {
          var size = i > 1 ? small : large;
          rightSlots.push(makeStandardSlot(size, level, offset));
          offset += size;
        }
        var left = makeRelaxedSlot(leftSlots);
        var right = makeRelaxedSlot(rightSlots);
        return [left, right];
      }

      function makeBalancedPair(originalPair: [Slot<string>, Slot<string>]): [Slot<string>, Slot<string>] {
        var leftSlots: Slot<string>[] = [];
        const level = 1;
        for(var i = 0, offset = 0; i < BRANCH_FACTOR; i++) {
          leftSlots.push(makeStandardSlot(large, level, offset));
          offset += large;
        }
        var left = makeRelaxedSlot(leftSlots);
        var right = makeRelaxedSlot([
          makeStandardSlot(small*3, 1, offset),
          makeStandardSlot(small, 1, offset += small*3)
        ]);
        copySum(originalPair[0], BRANCH_FACTOR - 4, left, BRANCH_FACTOR - 4);
        copySum(originalPair[0], BRANCH_FACTOR - 2, left, BRANCH_FACTOR - 3);
        copySum(originalPair[0], BRANCH_FACTOR - 1, left, BRANCH_FACTOR - 2);
        copySum(originalPair[1], 0, left, BRANCH_FACTOR - 1);
        copySum(originalPair[1], 1, right, 0);
        copySum(originalPair[1], 3, right, 1);
        left.recompute = 4;
        right.recompute = 2;
        return [left, right];
      }

      var nodesA = makeRelaxedPair();
      var nodesB = makeBalancedPair(nodesA);
      assert.notDeepEqual(nodesA, nodesB);
      compact(nodesA, BRANCH_INDEX_BITCOUNT*2, 2);
      assert.deepEqual(nodesA, nodesB);
    });

    test('the left node is expanded if there is available slot capacity', () => {
      function makeRelaxedPair(): [Slot<string>, Slot<string>] {
        var leftSlots: Slot<string>[] = [], rightSlots: Slot<string>[] = [];
        const level = 1;
        for(var i = 0, offset = 0; i < BRANCH_FACTOR - 1; i++) {
          var size = (i === BRANCH_FACTOR - 4 || i === BRANCH_FACTOR - 3) ? small : large;
          leftSlots.push(makeStandardSlot(size, level, offset));
          offset += size;
        }
        for(i = 0; i < BRANCH_FACTOR - 2; i++) {
          var size = i > 1 ? large : small;
          rightSlots.push(makeStandardSlot(size, level, offset));
          offset += size;
        }
        var left = makeRelaxedSlot(leftSlots);
        var right = makeRelaxedSlot(rightSlots);
        return [left, right];
      }

      var nodes = makeRelaxedPair();
      assert.strictEqual(nodes[0].slots.length, BRANCH_FACTOR - 1 );
      compact(nodes, BRANCH_INDEX_BITCOUNT*2, 2);
      assert.strictEqual(nodes[0].slots.length, BRANCH_FACTOR);
    });

    test('the right node is emptied if all remaining slots can be moved left', () => {
      function makeRelaxedPair(): [Slot<string>, Slot<string>] {
        var offset = 0;
        var left = makeRelaxedSlot([
          makeStandardSlot(large, 1, 0),
          makeStandardSlot(large, 1, offset += large),
          makeStandardSlot(small, 1, offset += large),
          makeStandardSlot(small, 1, offset += small),
          makeStandardSlot(large, 1, offset += small),
          makeStandardSlot(large, 1, offset += large)
        ]);
        var right = makeRelaxedSlot([
          makeStandardSlot(large, 1, offset += large),
          makeStandardSlot(large, 1, offset += large),
          makeStandardSlot(small, 1, offset += large),
          makeStandardSlot(small, 1, offset += small),
        ]);
        return [left, right];
      }

      function makeBalancedPair(originalPair: [Slot<string>, Slot<string>]): [Slot<string>, Slot<string>] {
        var offset = 0;
        var left = makeRelaxedSlot([
          makeStandardSlot(large, 1, 0),
          makeStandardSlot(large, 1, offset += large),
          makeStandardSlot(large, 1, offset += large),
          makeStandardSlot(large, 1, offset += large),
          makeStandardSlot(large, 1, offset += large),
          makeStandardSlot(large, 1, offset += large),
          makeStandardSlot(small*3, 1, offset += large),
          makeStandardSlot(small, 1, offset += small*3)
        ]);
        var right = makeRelaxedSlot([]);
        copySum(originalPair[0], 2, left, 2);
        copySum(originalPair[0], 4, left, 3);
        copySum(originalPair[0], 5, left, 4);
        copySum(originalPair[1], 0, left, 5);
        copySum(originalPair[1], 1, left, 6);
        copySum(originalPair[1], 3, left, 7);
        left.recompute = 6;
        right.recompute = 0;
        return [left, right];
      }

      var nodesA = makeRelaxedPair();
      var nodesB = makeBalancedPair(nodesA);
      assert.notDeepEqual(nodesA, nodesB);
      compact(nodesA, BRANCH_INDEX_BITCOUNT*2, 2);
      assert.deepEqual(nodesA, nodesB);
    });
  });

  suite('join()', () => {
    suite('When passed a pair of topmost nodes that should be merged into a single node,', () => {
      test('the function returns true', () => {
        var joined = join(makeJoinablePair(2), BRANCH_INDEX_BITCOUNT, true);
        assert.isTrue(joined);
      });

      test('all of the slots in the right node are moved to the left node', () => {
        var nodes = makeJoinablePair(2);
        var leftSize = nodes[0].size;
        var rightSize = nodes[1].size;
        join(nodes, BRANCH_INDEX_BITCOUNT, true);
        assert.strictEqual(nodes[0].size, leftSize + rightSize);
        assert.strictEqual(nodes[1].size, 0);
      });

      test('the cumulative sum is recalculated for each slot', () => {
        var nodes = makeJoinablePair(3);
        join(nodes, BRANCH_INDEX_BITCOUNT*2, true);
        for(var i = 0, sum = 0; i < nodes[0].slots.length; i++) {
          sum += BRANCH_FACTOR << BRANCH_INDEX_BITCOUNT;
          assert.strictEqual((<Slot<string>>nodes[0].slots[i]).sum, sum);
        }
      });

      test('the left node does not change into a relaxed node if all of the left slots were fully populated', () => {
        var nodes = makeJoinablePair(3);
        join(nodes, BRANCH_INDEX_BITCOUNT*2, true);
        assert.isFalse(nodes[0].isRelaxed());
      });

      test('the left node becomes a relaxed node if any slots other than the last are not fully populated', () => {
        var nodes = makeJoinablePair(3, 1);
        join(nodes, BRANCH_INDEX_BITCOUNT*2, true);
        assert.isTrue(nodes[0].isRelaxed());
      });

      test('the subcount of the right node is added to the subcount of the left node', () => {
        var nodes = makeJoinablePair(3);
        var leftSubcount = nodes[0].subcount, rightSubcount = nodes[1].subcount;
        join(nodes, BRANCH_INDEX_BITCOUNT*2, true);
        assert.strictEqual(nodes[0].subcount, leftSubcount + rightSubcount);
      });

      test('non-leaf nodes are joined correctly', () => {
        var nodes = makeJoinablePair(3);
        var expectedValues = gatherLeafValues(makeStandardSlot(nodes[0].size + nodes[1].size, 2, 0), false);
        join(nodes, BRANCH_INDEX_BITCOUNT*2, true);
        assert.deepEqual(gatherLeafValues(nodes[0], false), expectedValues);
      });

      test('leaf nodes are joined correctly', () => {
        var nodes = makeJoinablePair(1);
        var expectedValues = gatherLeafValues(makeStandardSlot(nodes[0].size + nodes[1].size, 0, 0), false);
        join(nodes, 0, true);
        assert.deepEqual(gatherLeafValues(nodes[0], false), expectedValues);
      });
    });

    suite('When passed a pair of nodes that do not need to be balanced,', () => {
      test('the function returns false', () => {
        var left = makeStandardSlot(BRANCH_FACTOR << (BRANCH_INDEX_BITCOUNT*2) - 1, 2, 0);
        var right = makeStandardSlot(BRANCH_FACTOR << (BRANCH_INDEX_BITCOUNT*2), 2, 0);

        assert.isFalse(join([left, right], BRANCH_INDEX_BITCOUNT*2, false));
      });

      test('the input nodes are not modified', () => {
        var left = makeStandardSlot(BRANCH_FACTOR << (BRANCH_INDEX_BITCOUNT*2) - 1, 2, 0);
        var right = makeStandardSlot(BRANCH_FACTOR << (BRANCH_INDEX_BITCOUNT*2), 2, 0);
        var nodes: [Slot<string>, Slot<string>] = [left, right];
        var leftJSON = JSON.stringify(left);
        var rightJSON = JSON.stringify(right);

        join(nodes, BRANCH_INDEX_BITCOUNT*2, false);

        assert.strictEqual(leftJSON, JSON.stringify(nodes[0]));
        assert.strictEqual(rightJSON, JSON.stringify(nodes[1]));
      });
    });
  });

  suite('concat()', () => {
    test('joins two minimal single-node lists', () => {
      var left = append(ListState.empty<any>(true), makeValues(1));
      var right = append(ListState.empty<any>(true), makeValues(2, 1));

      concat(left, right);

      var root = rootSlot(left);
      assert.isFalse(root.isRelaxed());
      assert.strictEqual(root.size, 3);
      assert.deepEqual(createArray(left), makeValues(3));
    });

    test('joins two single-level lists into a two-level result if capacity is exceeded', () => {
      var n0 = BRANCH_FACTOR/2 + 1;
      var n1 = n0 + 1;
      var left = append(ListState.empty<any>(true), makeValues(n0));
      var right = append(ListState.empty<any>(true), makeValues(n1, n0));

      concat(left, right);

      var root = rootSlot(left);
      assert.isTrue(root.isRelaxed());
      assert.strictEqual(root.size, n0 + n1);
      assert.deepEqual(createArray(left), makeValues(n0 + n1));
    });

    test('joins two multi-level lists into a higher-level result if capacity is exceeded', () => {
      var m = BRANCH_FACTOR/2;
      var n0 = BRANCH_FACTOR*m + 1;
      var n1 = BRANCH_FACTOR*m + 3;
      var left = append(ListState.empty<any>(true), makeValues(n0));
      var right = append(ListState.empty<any>(true), makeValues(n1, n0));

      concat(left, right);

      var root = rootSlot(left);
      assert.isTrue(root.isRelaxed());
      assert.strictEqual(root.size, n0 + n1);
      assert.deepEqual(createArray(left), makeValues(n0 + n1));
    });

    test('joins a deeper left list to a shallower right list', () => {
      var n0 = Math.pow(BRANCH_FACTOR, 2) + 1;
      var n1 = BRANCH_FACTOR + 1;
      var left = append(ListState.empty<any>(true), makeValues(n0));
      var right = append(ListState.empty<any>(true), makeValues(n1, n0));

      concat(left, right);

      assert.isTrue(left.right.parent.hasUncommittedChanges());
      assert.isTrue(left.right.parent.slot.isRelaxed());
      assert.strictEqual(left.size, n0 + n1);
      assert.deepEqual(createArray(left), makeValues(n0 + n1));
    });

    test('joins a shallower left list to a deeper right list', () => {
      var n0 = BRANCH_FACTOR + 1;
      var n1 = Math.pow(BRANCH_FACTOR, 2) + 1;
      var left = append(ListState.empty<any>(true), makeValues(n0));
      var right = append(ListState.empty<any>(true), makeValues(n1, n0));

      concat(left, right);

      var root = rootSlot(left);
      assert.isTrue(root.isRelaxed());
      assert.strictEqual(root.size, n0 + n1);
      assert.deepEqual(createArray(left), makeValues(n0 + n1));
    });

    test('joins lists when both lists each have pre-existing reserved head and tail views', () => {
      var values = makeValues(Math.pow(BRANCH_FACTOR, 2) - (BRANCH_FACTOR >>> 2));
      var leftValues = values.slice(0, BRANCH_FACTOR + (BRANCH_FACTOR >>> 1));
      var rightValues = values.slice(leftValues.length);
      var list1 = List.of<any>(leftValues).prepend('X');
      var list2 = List.of<any>(rightValues).prepend('Y');
      leftValues.unshift('X');
      rightValues.unshift('Y');

      var list3 = list1.concat(list2);

      assert.deepEqual(list1.toArray(), leftValues);
      assert.deepEqual(list2.toArray(), rightValues);
      assert.deepEqual(list3.toArray(), leftValues.concat(rightValues));
    });
  });
});
