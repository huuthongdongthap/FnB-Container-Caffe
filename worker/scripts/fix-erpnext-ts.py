import re

TARGET = '/Users/macbook/FnB-Container-Caffe/worker/src/routes/erpnext.ts'

with open(TARGET, 'r') as f:
    c = f.read()

# Fix POST /tag lines 141-149
old_post = """ if (method === 'POST' && path.endsWith('/tag')) {
  const customerId = path.replace('/customer/', '').replace('/tag', '');
  const body = erpnextTagSchema.safeParse(await request.json());
  await client.addTag(customerId, body.tag);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
 }"""

new_post = """ if (method === 'POST' && path.endsWith('/tag')) {
  const customerId = path.replace('/customer/', '').replace('/tag', '');
  const tagParsed = erpnextTagSchema.safeParse(await request.json());
  if (!tagParsed.success) {
    return new Response(JSON.stringify({ success: false, error: tagParsed.error.issues[0].message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  await client.addTag(customerId, tagParsed.data.tag);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
 }"""

if old_post in c:
    c = c.replace(old_post, new_post)
    print('OK: POST /tag fixed')
else:
    print('FAIL: POST /tag not found')

# Fix DELETE /tag
old_del = """ if (method === 'DELETE' && path.endsWith('/tag')) {
  const customerId = path.replace('/customer/', '').replace('/tag', '');
  const body = erpnextTagSchema.safeParse(await request.json());
  await client.removeTag(customerId, body.tag);"""

new_del = """ if (method === 'DELETE' && path.endsWith('/tag')) {
  const customerId = path.replace('/customer/', '').replace('/tag', '');
  const tagParsed = erpnextTagSchema.safeParse(await request.json());
  if (!tagParsed.success) {
    return new Response(JSON.stringify({ success: false, error: tagParsed.error.issues[0].message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  await client.removeTag(customerId, tagParsed.data.tag);"""

if old_del in c:
    c = c.replace(old_del, new_del)
    print('OK: DELETE /tag fixed')
else:
    print('FAIL: DELETE /tag not found')

# Fix PUT /customer/:id
old_put = "  const putParsed = erpnextConfigureSchema.safeParse(await request.json())\n  await client.updateCustomer(customerId, body as CrmUpdateData);"
new_put = "  const putParsed = erpnextConfigureSchema.safeParse(await request.json())\n  if (!putParsed.success) {\n    return new Response(JSON.stringify({ success: false, error: putParsed.error.issues[0].message }), { status: 400, headers: { 'Content-Type': 'application/json' } });\n  }\n  await client.updateCustomer(customerId, putParsed.data as CrmUpdateData);"

if old_put in c:
    c = c.replace(old_put, new_put)
    print('OK: PUT fixed')
else:
    print('FAIL: PUT not found')

with open(TARGET, 'w') as f:
    f.write(c)

# Final check
for pattern in ['body.tag', 'body as CrmUpdateData', 'Schema.parse(await request.json())']:
    if pattern in open(TARGET).read():
        print(f'FAIL: residual "{pattern}"')
    else:
        print(f'OK: "{pattern}"')

print('Done!')
