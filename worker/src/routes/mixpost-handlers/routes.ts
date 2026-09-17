import { Hono } from 'hono';
import { registerPostsHandler } from './posts-handler';
import { registerGenerateHandler } from './generate-handler';

export const mixpostRouter = new Hono();

registerPostsHandler(mixpostRouter);
registerGenerateHandler(mixpostRouter);
