// Resposta externa do ViaCEP. Ela é convertida para um formato pequeno e
// estável antes de chegar ao formulário de academia.
interface ViaCepResponse {
  erro?: boolean | 'true'
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export interface CepAddress {
  street: string
  neighborhood: string
  city: string
  state: string
  complement: string
}

export async function lookupCep(value: string, signal?: AbortSignal): Promise<CepAddress> {
  const cep = value.replace(/\D/g, '')
  if (cep.length !== 8) throw new Error('Informe os 8 números do CEP.')

  let response: Response
  try {
    response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Não foi possível consultar o CEP. Confira sua conexão e tente novamente.')
  }

  if (!response.ok) throw new Error('Não foi possível consultar este CEP.')
  const data = await response.json() as ViaCepResponse
  if (data.erro === true || data.erro === 'true') throw new Error('CEP não encontrado.')

  return {
    street: data.logradouro?.trim() ?? '',
    neighborhood: data.bairro?.trim() ?? '',
    city: data.localidade?.trim() ?? '',
    state: data.uf?.trim().toUpperCase() ?? '',
    complement: data.complemento?.trim() ?? '',
  }
}
