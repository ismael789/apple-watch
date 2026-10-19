export const corsHeaders = {
  'Access-Control-Allow-Headers':
    'apikey, authorization, content-type, idempotency-key, x-client-info, x-wallet-access-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
    },
  });

export const preflightResponse = () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const requirePost = (request: Request) => {
  if (request.method !== 'POST') {
    throw new HttpError(405, 'Método no permitido.');
  }
};

export const readJson = async (request: Request) => {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 4096) throw new HttpError(413, 'Solicitud demasiado grande.');
  try {
    return await request.json();
  } catch (_error) {
    throw new HttpError(400, 'JSON inválido.');
  }
};

export const handleError = (error: unknown) => {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message }, error.status);
  }
  console.error('wallet-edge-error', {
    name: error instanceof Error ? error.name : 'UnknownError',
  });
  return jsonResponse({ error: 'No se pudo procesar la solicitud.' }, 500);
};

