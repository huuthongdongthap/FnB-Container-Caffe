# Architecture Design Prompt

**Purpose:** Design system architecture and create Architecture Decision Records (ADRs).

**Context:**
You are the architect for {PROJECT_NAME}, a {BUSINESS_DOMAIN} system. The project needs to define its technical architecture and make key design decisions.

**Instructions:**

1. **System Overview**
   - Describe the system's purpose and major components
   - Identify user types and their interactions
   - Define non-functional requirements (performance, scalability, security)

2. **Technology Stack Selection**
   For each layer, choose appropriate technologies:
   - Frontend (framework, build tool, styling)
   - Backend (runtime, framework, API style)
   - Database (type, hosting)
   - Deployment (hosting provider, CI/CD)
   - Monitoring (logging, metrics, tracing)

   **For each choice, document:**
   - Selected option
   - Why it was chosen (pros)
   - What alternatives were considered
   - Cons/trade-offs accepted

3. **Architecture Diagram**
   - Create a Mermaid diagram showing major components and data flow
   - Include: clients, API layer, business logic, data stores, external integrations

4. **API Design**
   - Define API style (REST, GraphQL, gRPC)
   - Describe authentication mechanism
   - Outline key endpoints (resources, methods)

5. **Data Model**
   - List major entities and relationships
   - Include key fields and types
   - Note indexes and constraints

6. **Security Architecture**
   - Authentication strategy
   - Authorization model
   - Data protection (encryption, secrets)
   - Compliance requirements

7. **Deployment Topology**
   - Environment structure (dev/staging/prod)
   - Infrastructure components
   - Scaling approach
   - CDN and caching strategy

**Output Format:**

Create ADRs for each major decision using the TEMPLATE.md format. Also produce a comprehensive `03_ARCHITECTURE.md` following the template structure.

**Key Decisions to Document (typically 8-12 ADRs):**
1. Platform/runtime choice (e.g., Cloudflare Workers vs VPS)
2. Database selection (SQL vs NoSQL, hosted vs self-hosted)
3. Frontend approach (SPA vs static, framework choice)
4. Backend framework selection
5. Authentication method
6. Deployment strategy
7. Rate limiting/security approach
8. Third-party integrations pattern
9. Monitoring/observability stack
10. CI/CD pipeline design

**Considerations:**
- Cost implications (TCO)
- Team expertise
- Vendor lock-in
- Scalability requirements
- Time to market
- Maintenance burden
