# API Documentation

## Authentication Endpoints
- `POST /api/v1/auth/login`: Authenticate and get JWT token.

## Printers Endpoints
- `GET /api/v1/printers`: List all printers.
- `POST /api/v1/printers`: Create a new printer (Admin only).
- `PUT /api/v1/printers/{id}`: Update printer.
- `DELETE /api/v1/printers/{id}`: Delete printer.
- `POST /api/v1/printers/import/csv`: Bulk import printers.
- `GET /api/v1/printers/export/csv`: Export printers to CSV.

## Groups Endpoints
- `GET /api/v1/groups`: List printer groups.
- `POST /api/v1/groups`: Create a new group.

## WebSocket
- `ws://<host>/api/v1/ws`: Subscribe for real-time metric updates.

*(API docs are also available interactively via Swagger UI at `/docs` when the backend is running).*
