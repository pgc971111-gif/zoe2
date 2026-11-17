const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const defaultHeaders = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  "Content-Type": "application/json",
};

export const supabase = {
  from: (table: string) => ({
    select: (columns: string = "*") => {
      let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;
      let isSingle = false;
      
      const builder: any = {
        eq: (column: string, value: any) => {
          url += `&${column}=eq.${value}`;
          return builder;
        },
        order: (orderColumn: string, options?: { ascending?: boolean }) => {
          const dir = options?.ascending === false ? "desc" : "asc";
          url += `&order=${orderColumn}.${dir}`;
          return builder;
        },
        single: () => {
          isSingle = true;
          return builder;
        },
        then: async (resolve: any) => {
          try {
            const res = await fetch(url, { headers: defaultHeaders });
            const data = await res.json();
            if (!res.ok) {
              resolve({ data: null, error: { message: data.message || "Error de red" } });
              return;
            }
            resolve({ data: isSingle && Array.isArray(data) ? data[0] : data, error: null });
          } catch (e) {
            resolve({ data: null, error: { message: "Error de conexión" } });
          }
        }
      };
      return builder;
    },

    insert: (values: any) => {
      const insertBuilder: any = {
        select: () => ({
          single: async () => {
            try {
              const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
                method: "POST",
                headers: { ...defaultHeaders, Prefer: "return=representation" },
                body: JSON.stringify(values),
              });
              if (!res.ok) {
                const err = await res.json();
                return { data: null, error: { message: err.message || err.details || "Error de Supabase" } };
              }
              const data = await res.json();
              return { data: Array.isArray(data) ? data[0] : data, error: null };
            } catch (e) {
              return { data: null, error: { message: "Error de conexión" } };
            }
          }
        }),
        then: async (resolve: any) => {
          try {
            const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
              method: "POST",
              headers: defaultHeaders,
              body: JSON.stringify(values),
            });
            if (!res.ok) {
              const err = await res.json();
              // AQUÍ ESTÁ LA MAGIA: Mostramos el error real de Supabase
              resolve({ error: { message: err.message || err.details || JSON.stringify(err) } });
            } else {
              resolve({ error: null });
            }
          } catch (e) {
            resolve({ error: { message: "Error de conexión en fetch" } });
          }
        }
      };
      return insertBuilder;
    },

    update: (values: any) => ({
      eq: async (column: string, value: any) => {
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
            method: "PATCH",
            headers: defaultHeaders,
            body: JSON.stringify(values),
          });
          return { error: res.ok ? null : { message: "Error al actualizar" } };
        } catch (e) {
          return { error: { message: "Error de conexión" } };
        }
      },
    }),

    delete: () => ({
      eq: async (column: string, value: any) => {
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
            method: "DELETE",
            headers: defaultHeaders,
          });
          return { error: res.ok ? null : { message: "Error al borrar" } };
        } catch (e) {
          return { error: { message: "Error de conexión" } };
        }
      },
    }),
  }),
};