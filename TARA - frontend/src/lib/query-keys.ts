export const queryKeys = {
  clients: {
    all: ["clients"] as const,
    list: (page: number, includeDeleted: boolean, search: string) =>
      ["clients", page, includeDeleted, search] as const,
    detail: (id: string | number) => ["client", id] as const,
    contacts: (id: string | number) => ["client-contacts", id] as const,
    linkCount: (id: number) => ["client-link-count", id] as const,
  },
  vendors: {
    all: ["vendors"] as const,
    list: (page: number, includeDeleted: boolean, search: string) =>
      ["vendors", page, includeDeleted, search] as const,
    detail: (id: string | number) => ["vendor", id] as const,
    contacts: (id: string | number) => ["vendor-contacts", id] as const,
    links: (id: string | number, includeDeleted: boolean) =>
      ["vendor-links", id, includeDeleted] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    list: (page: number, includeDeleted: boolean) =>
      ["jobs", page, includeDeleted] as const,
    detail: (id: string | number) => ["job", id] as const,
    applications: (id: string | number, page: number) =>
      ["job-applications", id, page] as const,
    candidateApplications: (candidateId: string | number, page: number) =>
      ["candidate-job-applications", candidateId, page] as const,
    routing: (id: string | number) => ["job-routing", id] as const,
    transitions: (id: string | number, page: number) =>
      ["job-transitions", id, page] as const,
  },
  candidates: {
    all: ["candidates"] as const,
    list: (page: number, includeDeleted: boolean) =>
      ["candidates", page, includeDeleted] as const,
    detail: (id: string | number) => ["candidate", id] as const,
    resumes: (id: string | number) => ["candidate-resumes", id] as const,
  },
  links: {
    all: ["links"] as const,
    list: (page: number, includeDeleted: boolean) =>
      ["links", page, includeDeleted] as const,
  },
  audit: {
    all: ["audit"] as const,
    list: (page: number) => ["audit", page] as const,
  },
  reporting: {
    operational: ["reporting", "operational"] as const,
  },
  users: {
    all: ["users"] as const,
    list: (page: number, includeDeleted: boolean, search: string) =>
      ["users", page, includeDeleted, search] as const,
  },
  tenancy: {
    resumeUploadSettings: ["tenant-resume-upload-settings"] as const,
  },
} as const;
