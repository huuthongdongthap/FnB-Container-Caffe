import { Hono } from 'hono';
import type { MixpostEnv } from '../../types/env';
import { registerPostsHandler } from './posts-handler';
import { registerGenerateHandler } from './generate-handler';

export const mixpostRouter = new Hono<{ Bindings: MixpostEnv }>();

registerPostsHandler(mixpostRouter);
registerGenerateHandler(mixpostRouter);
