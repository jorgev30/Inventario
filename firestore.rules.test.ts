/**
 * Firestore Security Rules Test Suite — Verifies the "Dirty Dozen" adversarial payloads
 * return PERMISSION_DENIED and valid owner operations succeed.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'list' | 'get';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  docId?: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collection: 'products',
    operation: 'create',
    auth: null,
    docId: 'prod_1',
    payload: { ownerId: 'user_1', name: 'Camión Dinosaurio' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    collection: 'products',
    operation: 'create',
    auth: { uid: 'user_1', email: 'jorgevillero7@gmail.com', email_verified: false },
    docId: 'prod_1',
    payload: { ownerId: 'user_1', name: 'Camión Dinosaurio' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    collection: 'products',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    docId: 'prod_1',
    payload: { ownerId: 'victim_uid', name: 'Tablet 11 Pulgadas' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Create',
    collection: 'products',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'prod_1',
    payload: { ownerId: 'user_1', name: 'Jarrones Cerámica', isVerifiedAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'ID Poisoning Attack',
    collection: 'products',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'bad$id!with/slash',
    payload: { ownerId: 'user_1', name: 'Jarrones Cerámica' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Resource Exhaustion (Oversized Name)',
    collection: 'products',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'prod_1',
    payload: { ownerId: 'user_1', name: 'A'.repeat(500) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Negative Stock or Cost Injection',
    collection: 'products',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'prod_1',
    payload: { ownerId: 'user_1', name: 'Producto', unitCost: -100, quantity: -5 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Timestamp Forgery',
    collection: 'products',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'prod_1',
    payload: { ownerId: 'user_1', name: 'Producto', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Ownership Hijack on Update',
    collection: 'products',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'prod_1',
    payload: { ownerId: 'other_user' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning on Update',
    collection: 'products',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'prod_1',
    payload: { quantity: 'invalid_number_type' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Orphaned Movement Creation',
    collection: 'movements',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    docId: 'mov_1',
    payload: { ownerId: 'user_1', productId: 'non_existent_product_id' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List Scraping Across Users',
    collection: 'products',
    operation: 'list',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
