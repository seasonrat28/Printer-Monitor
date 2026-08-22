#!/usr/bin/env python3
"""printerctl - Command Line Interface for FUJIFILM Apeos & Network Printer Management.

Supports network auto-discovery, live device query, database listing,
status refresh, and JSON export for automated scripting.
"""

import argparse
import asyncio
import csv
import io
import json
import os
import sys

# Ensure UTF-8 stdout encoding on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import (
    delete_printer,
    get_logs,
    get_printer_by_id,
    get_printer_by_ip,
    get_stats,
    list_printers,
    update_printer_status,
    upsert_printer,
)
from services.discovery import discovery_engine, get_local_subnets
from services.printer import printer_service
from services.snmp import snmp_service

try:
    from rich.console import Console
    from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeRemainingColumn
    from rich.table import Table
    console = Console(highlight=False)
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console = None


def output_json(data: any) -> None:
    """Print standard JSON output to stdout."""
    print(json.dumps(data, indent=2, ensure_ascii=False))


# ============================================================================
# CLI Commands
# ============================================================================

def cmd_discover(args) -> None:
    """Run network discovery."""
    network = args.network
    if not network:
        subnets = get_local_subnets()
        network = subnets[0] if subnets else "192.168.1.0/24"

    is_json = getattr(args, "json", False)

    if not is_json:
        if HAS_RICH:
            console.print("\n[bold cyan]Printer Discovery[/bold cyan]")
            console.print("=" * 45)
            console.print(f"Scanning network: [yellow]{network}[/yellow]\n")
        else:
            print(f"Printer Discovery\nScanning network: {network}")

    async def _run():
        if HAS_RICH and not is_json:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(complete_style="green", finished_style="bold green"),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TimeRemainingColumn(),
                console=console
            ) as progress:
                task_id = progress.add_task(f"Scanning {network}...", total=100)

                def _cb(status):
                    progress.update(
                        task_id,
                        completed=status.get("percent", 0),
                        description=f"Scanning {network} (Found: {status.get('found_count', 0)})"
                    )

                results = await discovery_engine.run_discovery(
                    network_or_target=network,
                    concurrency_limit=args.concurrency,
                    timeout=args.timeout,
                    progress_callback=_cb
                )
                progress.update(task_id, completed=100)
                return results
        else:
            return await discovery_engine.run_discovery(
                network_or_target=network,
                concurrency_limit=args.concurrency,
                timeout=args.timeout
            )

    results = asyncio.run(_run())

    if is_json:
        output_json({
            "status": "success",
            "network": network,
            "found_count": len(results),
            "printers": results
        })
        return

    if HAS_RICH:
        console.print(f"\n[bold green]Found: {len(results)} devices[/bold green]\n")
        if results:
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("IP Address", style="cyan")
            table.add_column("Manufacturer", style="white")
            table.add_column("Model", style="green")
            table.add_column("Serial", style="yellow")
            table.add_column("Toner %", justify="right")
            table.add_column("Status", justify="center")

            for p in results:
                st = p.get("status", "ONLINE")
                st_color = "green" if st == "ONLINE" else ("yellow" if st == "WARNING" else "red")
                t_pct = f"{p.get('toner_black', 0)}%" if p.get("toner_black") is not None else "N/A"
                table.add_row(
                    p.get("ip_address", ""),
                    p.get("manufacturer", "Unknown"),
                    p.get("model", "Printer"),
                    p.get("serial_number", "N/A"),
                    t_pct,
                    f"[{st_color}]{st}[/{st_color}]"
                )
            console.print(table)
        console.print(f"\n[dim]Discovery completed in {discovery_engine.scan_status.get('elapsed_seconds', 0)}s[/dim]\n")
    else:
        print(f"\nFound: {len(results)} devices\n")
        print(f"{'IP':<16} {'Manufacturer':<15} {'Model':<20} {'Status':<10}")
        print("-" * 65)
        for p in results:
            print(f"{p.get('ip_address',''):<16} {p.get('manufacturer',''):<15} {p.get('model',''):<20} {p.get('status',''):<10}")
        print(f"\nDiscovery completed in {discovery_engine.scan_status.get('elapsed_seconds', 0)}s\n")


def cmd_list(args) -> None:
    """List printers stored in SQLite database."""
    printers = list_printers(
        search=args.search,
        status=args.status,
        sort_by=args.sort,
        order=args.order
    )

    if getattr(args, "json", False):
        output_json(printers)
        return

    if not printers:
        if HAS_RICH:
            console.print("[yellow]No printers found in database. Run 'printerctl discover' to scan network.[/yellow]")
        else:
            print("No printers found in database. Run 'printerctl discover' to scan network.")
        return

    if HAS_RICH:
        table = Table(title="Registered Network Printers", show_header=True, header_style="bold blue")
        table.add_column("ID", justify="right", style="dim")
        table.add_column("Status", justify="center")
        table.add_column("IP Address", style="bold cyan")
        table.add_column("Hostname", style="dim")
        table.add_column("Manufacturer", style="white")
        table.add_column("Model", style="green")
        table.add_column("Serial", style="yellow")
        table.add_column("Page Count", justify="right")
        table.add_column("Toner %", justify="right")
        table.add_column("Last Seen", style="dim")

        for p in printers:
            st = p.get("status", "UNKNOWN")
            st_style = "green" if st == "ONLINE" else ("yellow" if st == "WARNING" else ("red" if st == "ERROR" else "dim"))
            t_pct = f"{p.get('toner_black', 0)}%" if p.get("toner_black") is not None else "N/A"
            table.add_row(
                str(p.get("id", "")),
                f"[{st_style}]{st}[/{st_style}]",
                p.get("ip_address", ""),
                p.get("hostname", "") or "-",
                p.get("manufacturer", "Unknown"),
                p.get("model", "Printer"),
                p.get("serial_number", "N/A"),
                f"{p.get('page_count', 0):,}",
                t_pct,
                p.get("last_seen", "") or "-"
            )
        console.print(table)
    else:
        print(f"{'ID':<4} {'Status':<10} {'IP':<16} {'Manufacturer':<15} {'Model':<20} {'Toner':<8} {'Pages':<10}")
        print("-" * 85)
        for p in printers:
            print(f"{p.get('id',''):<4} {p.get('status',''):<10} {p.get('ip_address',''):<16} {p.get('manufacturer',''):<15} {p.get('model',''):<20} {p.get('toner_black',0)}% {p.get('page_count',0)}")


def cmd_info(args) -> None:
    """Show detailed info for a specific printer."""
    target = args.target.strip()
    printer = None
    if target.isdigit():
        printer = get_printer_by_id(int(target))
    if not printer:
        printer = get_printer_by_ip(target)

    if not printer:
        if getattr(args, "json", False):
            output_json({"error": f"Printer not found: {target}"})
        else:
            print(f"Error: Printer not found: {target}")
        sys.exit(1)

    if getattr(args, "json", False):
        output_json(printer)
        return

    if HAS_RICH:
        table = Table(title=f"Printer Details: {printer.get('manufacturer')} {printer.get('model')}", show_header=False)
        table.add_column("Property", style="bold cyan")
        table.add_column("Value", style="white")

        table.add_row("ID", str(printer.get("id")))
        table.add_row("Status", printer.get("status"))
        table.add_row("IP Address", printer.get("ip_address"))
        table.add_row("Hostname", printer.get("hostname") or "N/A")
        table.add_row("MAC Address", printer.get("mac_address") or "N/A")
        table.add_row("Manufacturer", printer.get("manufacturer"))
        table.add_row("Model", printer.get("model"))
        table.add_row("Serial Number", printer.get("serial_number") or "N/A")
        table.add_row("Location", printer.get("location") or "N/A")
        table.add_row("Page Count", f"{printer.get('page_count', 0):,}")
        table.add_row("Black Toner", f"{printer.get('toner_black', 0)}%")
        table.add_row("Drum Unit", f"{printer.get('drum_level', 0)}%")
        table.add_row("Firmware", printer.get("firmware_version") or "N/A")
        table.add_row("Web Interface", printer.get("web_url") or f"http://{printer.get('ip_address')}")
        table.add_row("Last Seen", printer.get("last_seen") or "N/A")
        table.add_row("Created At", printer.get("created_at") or "N/A")
        table.add_row("Updated At", printer.get("updated_at") or "N/A")
        console.print(table)
    else:
        for k, v in printer.items():
            if k != "raw_data":
                print(f"{k:<20}: {v}")


def cmd_status(args) -> None:
    """Check live status of a printer."""
    target = args.target.strip()
    printer = get_printer_by_ip(target)
    if not printer and target.isdigit():
        printer = get_printer_by_id(int(target))

    ip = printer.get("ip_address") if printer else target

    async def _get_live():
        return await printer_service.probe_device(ip)

    live_data = asyncio.run(_get_live())

    if not live_data:
        status_info = {
            "ip_address": ip,
            "status": "OFFLINE",
            "message": "Device not reachable via SNMP / HTTP"
        }
    else:
        status_info = {
            "ip_address": ip,
            "status": live_data.get("status", "ONLINE"),
            "manufacturer": live_data.get("manufacturer"),
            "model": live_data.get("model"),
            "toner_black": live_data.get("toner_black"),
            "drum_level": live_data.get("drum_level"),
            "page_count": live_data.get("page_count")
        }

    if getattr(args, "json", False):
        output_json(status_info)
    else:
        if HAS_RICH:
            st = status_info.get("status", "UNKNOWN")
            st_color = "green" if st == "ONLINE" else ("yellow" if st == "WARNING" else "red")
            console.print(f"\n[bold]Status for {ip}:[/bold] [{st_color}]{st}[/{st_color}]")
            if live_data:
                console.print(f"Model: {live_data.get('manufacturer')} {live_data.get('model')}")
                console.print(f"Toner: {live_data.get('toner_black')}% | Drum: {live_data.get('drum_level')}% | Pages: {live_data.get('page_count'):,}\n")
        else:
            print(f"Status for {ip}: {status_info.get('status')}")


def cmd_refresh(args) -> None:
    """Manually refresh a printer via SNMP and update database."""
    target = args.target.strip()
    printer = get_printer_by_ip(target)
    if not printer and target.isdigit():
        printer = get_printer_by_id(int(target))

    ip = printer.get("ip_address") if printer else target

    async def _refresh():
        updated = await printer_service.probe_device(ip)
        if updated:
            saved = upsert_printer(updated)
            return saved, True
        else:
            saved = update_printer_status(ip, "OFFLINE")
            return saved, False

    result, is_online = asyncio.run(_refresh())

    if getattr(args, "json", False):
        output_json({
            "status": "success" if is_online else "offline",
            "printer": result
        })
    else:
        if HAS_RICH:
            if is_online:
                console.print(f"[bold green]Successfully refreshed {ip}[/bold green]: {result.get('manufacturer')} {result.get('model')} (Status: {result.get('status')})")
            else:
                console.print(f"[bold red]Failed to reach {ip}[/bold red]: Marked as OFFLINE")
        else:
            print(f"Refreshed {ip}: Status = {result.get('status') if result else 'OFFLINE'}")


def cmd_export(args) -> None:
    """Export printer records as CSV or JSON."""
    fmt = args.format.lower()
    printers = list_printers()

    out_content = ""
    if fmt == "csv":
        output = io.StringIO()
        fieldnames = [
            "id", "ip_address", "hostname", "mac_address", "manufacturer", "model",
            "serial_number", "device_name", "location", "status", "page_count",
            "toner_black", "drum_level", "firmware_version", "web_url", "last_seen"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for p in printers:
            writer.writerow(p)
        out_content = output.getvalue()
    else:
        out_content = json.dumps(printers, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out_content)
        if HAS_RICH:
            console.print(f"[bold green]Successfully exported {len(printers)} printers to {args.output}[/bold green]")
        else:
            print(f"Successfully exported {len(printers)} printers to {args.output}")
    else:
        print(out_content)


def cmd_health(args) -> None:
    """Display system health and network stats."""
    stats = get_stats()
    subnets = get_local_subnets()

    health_data = {
        "status": "healthy",
        "database": "connected",
        "local_subnets": subnets,
        "statistics": stats
    }

    if getattr(args, "json", False):
        output_json(health_data)
        return

    if HAS_RICH:
        console.print("\n[bold cyan]System Health & Diagnostics[/bold cyan]")
        console.print("=" * 45)
        console.print("[green]Database:[/green] Connected (SQLite)")
        console.print(f"[green]Local Subnets:[/green] {', '.join(subnets)}")
        console.print("\n[bold]Printer Status Overview:[/bold]")
        console.print(f"  * Total Registered: [bold]{stats['total']}[/bold]")
        console.print(f"  * Online:           [bold green]{stats['online']}[/bold green]")
        console.print(f"  * Warning:          [bold yellow]{stats['warning']}[/bold yellow]")
        console.print(f"  * Error:            [bold red]{stats['error']}[/bold red]")
        console.print(f"  * Offline:          [bold dim]{stats['offline']}[/bold dim]\n")
    else:
        print("System Health:")
        print(f"  Subnets: {', '.join(subnets)}")
        print(f"  Total: {stats['total']}, Online: {stats['online']}, Warning: {stats['warning']}, Error: {stats['error']}, Offline: {stats['offline']}")


# ============================================================================
# Argument Parser
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        prog="printerctl",
        description="Printer Management & Monitoring CLI (FUJIFILM Apeos 4620 SZ & Standard Printers)"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # discover
    p_disc = subparsers.add_parser("discover", aliases=["scan"], help="Discover printers on the network")
    p_disc.add_argument("--network", "-n", type=str, default=None, help="Target network CIDR or IP range (e.g. 192.168.1.0/24)")
    p_disc.add_argument("--concurrency", "-c", type=int, default=50, help="Max concurrent scans")
    p_disc.add_argument("--timeout", "-t", type=float, default=1.2, help="SNMP / probe timeout (seconds)")
    p_disc.add_argument("--json", action="store_true", help="Output results as JSON")
    p_disc.set_defaults(func=cmd_discover)

    # list
    p_list = subparsers.add_parser("list", help="List registered printers")
    p_list.add_argument("--search", "-s", type=str, default=None, help="Search by IP, name, model, serial")
    p_list.add_argument("--status", type=str, default=None, help="Filter by status (ONLINE, WARNING, ERROR, OFFLINE)")
    p_list.add_argument("--sort", type=str, default="id", help="Sort column (id, ip, name, model, page_count, toner)")
    p_list.add_argument("--order", type=str, default="asc", choices=["asc", "desc"], help="Sort direction")
    p_list.add_argument("--json", action="store_true", help="Output list as JSON")
    p_list.set_defaults(func=cmd_list)

    # info
    p_info = subparsers.add_parser("info", help="Get full details for a printer")
    p_info.add_argument("target", type=str, help="Printer IP address or Database ID")
    p_info.add_argument("--json", action="store_true", help="Output info as JSON")
    p_info.set_defaults(func=cmd_info)

    # status
    p_status = subparsers.add_parser("status", help="Get real-time live status for a printer")
    p_status.add_argument("target", type=str, help="Printer IP address or Database ID")
    p_status.add_argument("--json", action="store_true", help="Output status as JSON")
    p_status.set_defaults(func=cmd_status)

    # refresh
    p_ref = subparsers.add_parser("refresh", help="Refresh printer status via SNMP and update database")
    p_ref.add_argument("target", type=str, help="Printer IP address or Database ID")
    p_ref.add_argument("--json", action="store_true", help="Output result as JSON")
    p_ref.set_defaults(func=cmd_ref) if False else p_ref.set_defaults(func=cmd_refresh)

    # export
    p_exp = subparsers.add_parser("export", help="Export printers database")
    p_exp.add_argument("--format", "-f", type=str, default="json", choices=["json", "csv"], help="Export format (json or csv)")
    p_exp.add_argument("--output", "-o", type=str, default=None, help="Output file path")
    p_exp.set_defaults(func=cmd_export)

    # health
    p_health = subparsers.add_parser("health", help="Check system health and status")
    p_health.add_argument("--json", action="store_true", help="Output health as JSON")
    p_health.set_defaults(func=cmd_health)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
