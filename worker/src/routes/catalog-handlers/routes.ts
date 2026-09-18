import { OpenAPIHono } from '@hono/zod-openapi';
import { getCustomerMenuHandler, getMenuItemHandler } from './handlers';

export const catalogRouter = new OpenAPIHono()
  .get('/menu', getCustomerMenuHandler)
  .get('/menu/:id', getMenuItemHandler)
  .get('/menu/customer', getCustomerMenuHandler)
  .get('/menu/items/:id', getMenuItemHandler);