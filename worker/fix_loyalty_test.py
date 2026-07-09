#!/usr/bin/env python3
"""Fix loyalty test file"""

path = '/Users/macbook/FnB-Container-Caffe/worker/src/__tests__/tree/loyalty/index.test.ts'

with open(path, 'r') as f:
    content = f.read()

# 1. Fix makeThrottleCtx - add json method and executionCtx
old = """function makeThrottleCtx(ip: string, kvStore: unknown): Record<string, unknown> {
 return {
  req: {
   header: (h: string) => (h === 'CF-Connecting-IP' ? ip : undefined),
   json: async () => ({ phone: '' }),
  },
  env: { AUTH_KV: kvStore },
 };
}"""

new = """function makeThrottleCtx(ip: string, kvStore: unknown): Record<string, unknown> {
 return {
  req: {
   header: (h: string) => (h === 'CF-Connecting-IP' ? ip : undefined),
   json: async () => ({ phone: '' }),
  },
  env: { AUTH_KV: kvStore },
  json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }),
  executionCtx: { waitUntil: (_p: Promise<unknown>) => {} },
 };
}"""

if old in content:
    content = content.replace(old, new)
    print("Fixed makeThrottleCtx")
else:
    print("ERROR: makeThrottleCtx pattern not found")

with open(path, 'w') as f:
    f.write(content)
print("Done")
