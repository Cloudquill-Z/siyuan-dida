export async function kernelApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`SiYuan API failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { code: number; msg?: string; data: T };
  if (payload.code !== 0) {
    throw new Error(payload.msg || `SiYuan API returned code ${payload.code}`);
  }
  return payload.data;
}

export interface SiYuanNotebook {
  id: string;
  name: string;
}

export async function listNotebooks(): Promise<SiYuanNotebook[]> {
  const data = await kernelApi<{ notebooks: SiYuanNotebook[] }>("/api/notebook/lsNotebooks", {});
  return data.notebooks;
}
