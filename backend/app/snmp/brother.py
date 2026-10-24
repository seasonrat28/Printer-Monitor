from typing import Dict, Any, Optional, Tuple
from app.snmp.standard import StandardSNMPAdapter

class BrotherSNMPAdapter(StandardSNMPAdapter):
    """
    Brother Enterprise SNMP Adapter using Brother Private Enterprise MIB (1.3.6.1.4.1.2435.*).
    Reverse-engineered from Brother BRAdmin Professional 4 (Project Umbrella) Template & MibUtil.
    """
    # Brother Enterprise OIDs
    BROTHER_MODEL_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.1.0"
    BROTHER_SERIAL_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0"
    BROTHER_FIRMWARE_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.0"
    BROTHER_LCD_DISPLAY_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.58.1.1.2.1"
    BROTHER_TOTAL_PAGE_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.17.0"
    BROTHER_COLOR_PAGE_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.20.0"
    BROTHER_MONO_PAGE_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.24.0"

    # Brother Toner / Ink remaining percentage OID prefix
    # 70.1.1.2.1 = Black, .2 = Cyan, .3 = Magenta, .4 = Yellow
    BROTHER_TONER_TABLE = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.70.1.1.2"
    
    # Brother Drum unit life remaining %
    BROTHER_DRUM_LIFE_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.82.4.0"
    BROTHER_DRUM_LIFE_ALT_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.82.1.0"
    
    # Brother Consumable life remaining (Belt, Fuser, Paper Feed Roller)
    BROTHER_FUSER_LIFE_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.52.21.1.2.1"
    BROTHER_LASER_LIFE_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.52.21.1.2.2"
    BROTHER_PF_ROLLER_OID = "1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.52.21.1.2.3"

    async def get_system_info(self) -> Dict[str, Any]:
        info = await super().get_system_info()
        
        # Override with exact Brother Private OIDs if available
        try:
            br_model = await self._get_oid(self.BROTHER_MODEL_OID)
            if br_model and br_model.strip():
                info["model"] = br_model.strip()
                
            br_serial = await self._get_oid(self.BROTHER_SERIAL_OID)
            if br_serial and br_serial.strip():
                info["serialNumber"] = br_serial.strip()
                
            br_fw = await self._get_oid(self.BROTHER_FIRMWARE_OID)
            if br_fw and br_fw.strip():
                info["firmware"] = br_fw.strip()
        except Exception:
            pass
            
        return info

    async def get_status(self) -> Tuple[str, Optional[str]]:
        final_status, status_message = await super().get_status()
        
        # Query real-time LCD Display string from Brother printer front panel
        try:
            br_lcd = await self._get_oid(self.BROTHER_LCD_DISPLAY_OID)
            if br_lcd and br_lcd.strip():
                clean_lcd = br_lcd.strip()
                # If standard status message was generic or empty, use the actual Brother LCD string
                if not status_message or status_message.strip().lower() in ["ready", "sleeping", "power saver", ""]:
                    status_message = clean_lcd
                elif clean_lcd.lower() not in status_message.lower():
                    status_message = f"{clean_lcd} | {status_message}"
                
                # Check for Brother error/warning states on LCD
                lcd_lower = clean_lcd.lower()
                if any(w in lcd_lower for w in ["jam", "cover open", "no paper", "error", "replace drum", "replace toner"]):
                    final_status = "ERROR"
                elif any(w in lcd_lower for w in ["low", "near end", "order"]):
                    if final_status != "ERROR":
                        final_status = "WARNING"
                elif any(w in lcd_lower for w in ["ready", "sleep"]):
                    if final_status not in ["ERROR", "WARNING"]:
                        final_status = "ONLINE"
        except Exception:
            pass

        return final_status, status_message

    async def get_supplies(self) -> Dict[str, Any]:
        # Start with standard MIB supplies
        supplies = await super().get_supplies()
        
        # Now supplement/override with Brother BRAdmin Enterprise OIDs
        try:
            # 1. Check Brother Toner levels (1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.70.1.1.2)
            toner_walk = await self._walk_oid(self.BROTHER_TONER_TABLE)
            if toner_walk:
                # 1 = Black, 2 = Cyan, 3 = Magenta, 4 = Yellow
                def parse_val(v):
                    try:
                        iv = int(v)
                        return iv if 0 <= iv <= 100 else None
                    except (ValueError, TypeError):
                        return None

                k_val = parse_val(toner_walk.get("1"))
                c_val = parse_val(toner_walk.get("2"))
                m_val = parse_val(toner_walk.get("3"))
                y_val = parse_val(toner_walk.get("4"))

                if k_val is not None:
                    supplies["toner_black_level"] = k_val
                    if supplies.get("toner_level") is None or supplies["toner_level"] == 0:
                        supplies["toner_level"] = k_val
                if c_val is not None:
                    supplies["toner_cyan_level"] = c_val
                if m_val is not None:
                    supplies["toner_magenta_level"] = m_val
                if y_val is not None:
                    supplies["toner_yellow_level"] = y_val

            # 2. Check Brother Drum Life %
            drum_val_raw = await self._get_oid(self.BROTHER_DRUM_LIFE_OID)
            if not drum_val_raw or not drum_val_raw.isdigit():
                drum_val_raw = await self._get_oid(self.BROTHER_DRUM_LIFE_ALT_OID)
                
            if drum_val_raw and drum_val_raw.isdigit():
                drum_life = int(drum_val_raw)
                if 0 <= drum_life <= 100:
                    supplies["drum_level"] = drum_life
                    if supplies.get("drum_black_level") is None:
                        supplies["drum_black_level"] = drum_life

            # 3. Check Brother Fuser, Laser, and Paper Feed Kit
            fuser_raw = await self._get_oid(self.BROTHER_FUSER_LIFE_OID)
            if fuser_raw and fuser_raw.isdigit():
                fuser_life = int(fuser_raw)
                if 0 <= fuser_life <= 100:
                    supplies["fuser_level"] = fuser_life

            laser_raw = await self._get_oid(self.BROTHER_LASER_LIFE_OID)
            if laser_raw and laser_raw.isdigit():
                laser_life = int(laser_raw)
                if 0 <= laser_life <= 100:
                    supplies["laser_unit_level"] = laser_life

            roller_raw = await self._get_oid(self.BROTHER_PF_ROLLER_OID)
            if roller_raw and roller_raw.isdigit():
                roller_life = int(roller_raw)
                if 0 <= roller_life <= 100:
                    supplies["pf_kit_1_level"] = roller_life

        except Exception:
            pass

        return supplies

    async def get_counters(self) -> Dict[str, Any]:
        counters = await super().get_counters()
        
        try:
            br_pages = await self._get_oid(self.BROTHER_TOTAL_PAGE_OID)
            if br_pages and br_pages.isdigit() and int(br_pages) > 0:
                counters["total_pages"] = int(br_pages)
                
            br_color = await self._get_oid(self.BROTHER_COLOR_PAGE_OID)
            if br_color and br_color.isdigit():
                counters["color_pages"] = int(br_color)
                
            br_mono = await self._get_oid(self.BROTHER_MONO_PAGE_OID)
            if br_mono and br_mono.isdigit():
                counters["mono_pages"] = int(br_mono)
        except Exception:
            pass

        return counters
