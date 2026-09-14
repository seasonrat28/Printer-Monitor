export interface Printer {
    id: number;
    ip_address: string;
    hostname: string;
    model: string;
    manufacturer: string;
    status: string;
    last_seen: string;
    toner_level?: number;
    toner_black_level?: number;
    toner_cyan_level?: number;
    toner_magenta_level?: number;
    toner_yellow_level?: number;
    drum_level?: number;
    fuser_level?: number;
    laser_unit_level?: number;
    pf_kit_mp_level?: number;
    pf_kit_1_level?: number;
    location?: string;
    serial_number?: string;
    status_message?: string;
    is_favorite?: boolean;
    page_count?: number;
}

