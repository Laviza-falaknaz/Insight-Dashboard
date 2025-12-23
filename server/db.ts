const POWER_AUTOMATE_URL = process.env.POWER_AUTOMATE_URL || "";

// Note: This module uses Power Automate HTTP POST API for database queries.
// Since Power Automate doesn't support true parameterized queries,
// all parameters are escaped and embedded in the SQL string.
// The buildWhereClause in routes.ts handles escaping for filter values.

export async function query<T>(queryString: string): Promise<T[]> {
  if (!POWER_AUTOMATE_URL) {
    throw new Error("POWER_AUTOMATE_URL environment variable is not set");
  }

  try {
    const response = await fetch(POWER_AUTOMATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: queryString }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Power Automate request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Query error: ${data.error}`);
    }

    // Power Automate returns array directly
    if (Array.isArray(data)) {
      return data as T[];
    }
    
    // Handle other possible response formats
    const results = data.ResultSets?.Table1 || data.value || data.body || 
                   data.result || data.results || data.Table1 || data.recordset;
    
    if (Array.isArray(results)) {
      return results as T[];
    }
    
    // Log unexpected format for debugging
    console.warn("Unexpected Power Automate response format:", Object.keys(data));
    return [];
  } catch (error) {
    console.error("Query execution error:", error);
    throw error;
  }
}

