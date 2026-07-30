#!/usr/bin/env python3
"""Apply the three-explicit-route replacement to worker/src/routes/tables.ts"""
import re

path = "worker/src/routes/tables.ts"
with open(path, "r") as f:
    content = f.read()

old = """// PATCH /api/tables/:id/* - unified handler for occupy/release/status
// Hono v4 matches the LAST registered route for /:id/*, so a single
// registered .patch('/:id/*') is required to handle all sub-paths.
tablesRouter.patch('/:id/*', async(c) => {
\tconst db = c.env.AURA_DB;
\tconst id = c.req.param('id');
\tconst tail: string = (c.req.param('*') as string | undefined) ?? '';

\tconst table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
\tif (!table) {
\t\treturn c.json({ success: false, error: 'Table not found' }, 404);
\t}

\tif (tail === 'occupy') {
\t\tawait db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind('Occupied', id).run();
\t\treturn c.json({ success: true, message: `Table ${id} -> Occupied` });
\t}
\tif (tail === 'release') {
\t\tawait db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind('Available', id).run();
\t\treturn c.json({ success: true, message: `Table ${id} -> Available` });
\t}
\tif (tail === 'status') {
\t\tconst body = await c.req.json() as Record<string, unknown>;
\t\tconst parsed = updateTableStatusSchema.safeParse(body);
\t\tif (!parsed.success) {
\t\t\treturn c.json({ success: false, error: parsed.error.issues[0].message }, 400);
\t\t}
\t\tconst { status } = parsed.data;
\t\tawait db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind(status, id).run();
\t\treturn c.json({ success: true, message: `Table ${id} -> ${status}` });
\t}
\treturn c.json({ success: false, error: 'Invalid PATCH target' }, 400);
});"""

new = """// Three explicit PATCH routes so Hono v4 matches them as specific paths,
// not shadowed by a catch-all wildcard.
// Helper for shared lookup logic
async function findTable(db: Env['AURA_DB'], id: string): Promise<CafeTable | null> {
\treturn await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
}

async function setStatus(db: Env['AURA_DB'], id: string, status: string) {
\tconst table = await findTable(db, id);
\tif (!table) return null;
\tawait db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind(status, id).run();
\treturn table;
}

// PATCH /api/tables/:id/occupy
tablesRouter.patch('/:id/occupy', async(c) => {
\tconst db = c.env.AURA_DB;
\tconst id = c.req.param('id');
\tconst table = await setStatus(db, id, 'Occupied');
\tif (!table) return c.json({ success: false, error: 'Table not found' }, 404);
\treturn c.json({ success: true, message: `Table ${id} -> Occupied` });
});

// PATCH /api/tables/:id/release
tablesRouter.patch('/:id/release', async(c) => {
\tconst db = c.env.AURA_DB;
\tconst id = c.req.param('id');
\tconst table = await setStatus(db, id, 'Available');
\tif (!table) return c.json({ success: false, error: 'Table not found' }, 404);
\treturn c.json({ success: true, message: `Table ${id} -> Available` });
});

// PATCH /api/tables/:id/status - set arbitrary status (e.g. Reserved, Overdue)
tablesRouter.patch('/:id/status', async(c) => {
\tconst db = c.env.AURA_DB;
\tconst id = c.req.param('id');
\tconst body = await c.req.json() as Record<string, unknown>;
\tconst parsed = updateTableStatusSchema.safeParse(body);
\tif (!parsed.success) {
\t\treturn c.json({ success: false, error: parsed.error.issues[0].message }, 400);
\t}
\tconst { status } = parsed.data;
\tconst table = await setStatus(db, id, status);
\tif (!table) return c.json({ success: false, error: 'Table not found' }, 404);
\treturn c.json({ success: true, message: `Table ${id} -> ${status}` });
});"""

if old in content:
    content = content.replace(old, new)
    with open(path, "w") as f:
        f.write(content)
    print("OK: Replacement applied")
else:
    print("FAIL: old text not found in file")
    # Print a snippet for debugging
    import subprocess
    r = subprocess.run(["grep", "-n", "PATCH", path], capture_output=True, text=True)
    print(r.stdout)
