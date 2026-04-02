import axios from './api/client';

const STRIKE_CONFIG_API = '/admin/clinic-strike-config';

export interface StrikeConfigResponse {
  configs: Record<string, string>;
  descriptions: Record<string, string>;
}

export interface StrikeConfigUpdateRequest {
  configKey: string;
  configValue: string;
}

export const getStrikeConfig = async (): Promise<StrikeConfigResponse> => {
  const { data } = await axios.get(STRIKE_CONFIG_API);
  return data;
};

export const updateStrikeConfig = async (
  body: StrikeConfigUpdateRequest
): Promise<Record<string, string>> => {
  const { data } = await axios.put(STRIKE_CONFIG_API, body);
  return data;
};
