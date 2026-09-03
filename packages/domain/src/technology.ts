import { z } from 'zod';

/** Access technologies the product distinguishes. Satellite is recognized but not listed in V1. */
export const Technology = z.enum(['fiber', 'cable', 'dsl', 'fixed_wireless', 'satellite', 'other']);
export type Technology = z.infer<typeof Technology>;
