import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type LicenseItem = {
  name: string;
  version: string;
  licenses: string;
  repository: string;
  publisher: string;
  licenseFile?: string;
  path?: string;
};

async function getData(): Promise<{
  generatedAt: string | null;
  items: LicenseItem[];
}> {
  try {
    const file = resolve(process.cwd(), "public/third-party-licenses.json");
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return { generatedAt: null, items: [] };
  }
}

export default async function LicensesPage() {
  const data = await getData();
  const items = data.items ?? [];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="mb-2">
        <a href="/">Top</a> &gt; <strong>licenses</strong>
      </p>
      <h1 className="text-2xl font-bold mb-2">Third-Party Licenses</h1>
      <p className="text-sm text-gray-500">
        {data.generatedAt
          ? `Generated: ${new Date(data.generatedAt).toLocaleString()}`
          : "No license data found."}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Showing {items.length} packages
      </p>

      <div className="overflow-x-auto rounded-xl border mt-4">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-3 py-2 text-left font-semibold"
                style={{ textAlign: "right" }}
              ></th>
              <th className="px-3 py-2 text-left font-semibold">Package</th>
              <th className="px-3 py-2 text-left font-semibold">Version</th>
              <th className="px-3 py-2 text-left font-semibold">License</th>
              <th className="px-3 py-2 text-left font-semibold">Repository</th>
              <th className="px-3 py-2 text-left font-semibold">Publisher</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-4" colSpan={5}>
                  No entries.
                </td>
              </tr>
            ) : (
              items.map((x, index) => (
                <tr
                  key={`${x.name}@${x.version}`}
                  className="odd:bg-white even:bg-gray-50"
                >
                  <td className="px-3 py-2" style={{ textAlign: "right" }}>
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">{x.name}</td>
                  <td className="px-3 py-2">{x.version}</td>
                  <td className="px-3 py-2">{x.licenses}</td>
                  <td className="px-3 py-2">
                    {x.repository ? (
                      <a
                        className="underline"
                        href={x.repository}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {x.repository}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">{x.publisher || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
