export interface Province {
    name: string;
    code: number;
    division_type: string;
    codename: string;
    phone_code: number;
}

export interface District {
    name: string;
    code: number;
    division_type: string;
    codename: string;
    province_code: number;
}

export interface Ward {
    name: string;
    code: number;
    division_type: string;
    codename: string;
    district_code: number;
}

const BASE_URL = 'https://provinces.open-api.vn/api';

export const locationService = {
    getProvinces: async (): Promise<Province[]> => {
        const response = await fetch(`${BASE_URL}/p/`);
        if (!response.ok) throw new Error('Failed to fetch provinces');
        return response.json();
    },

    getDistricts: async (provinceCode: number): Promise<District[]> => {
        const response = await fetch(`${BASE_URL}/p/${provinceCode}?depth=2`);
        if (!response.ok) throw new Error('Failed to fetch districts');
        const data = await response.json();
        return data.districts;
    },

    getWards: async (districtCode: number): Promise<Ward[]> => {
        const response = await fetch(`${BASE_URL}/d/${districtCode}?depth=2`);
        if (!response.ok) throw new Error('Failed to fetch wards');
        const data = await response.json();
        return data.wards;
    }
};
