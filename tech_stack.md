# LR-Ride Technology Stack & Dependencies

This document provides an exhaustive list of all major programming languages, frameworks, libraries, and cloud services utilized in the development of the LR-Ride application, along with their exact versions.

## 1. Frontend Development (Student & Driver Mobile Applications)

The mobile applications were built using a single cross-platform codebase.

*   **React Native** (`v0.81.5`): The core framework for building native Android and iOS applications using React.
*   **Expo** (`v54.0.0`): The primary development platform and build toolchain, heavily utilized for its pre-compiled native modules.
*   **React** (`v19.1.0`): The UI library underlying React Native.
*   **React Native Maps** (`v1.20.1`): Used for rendering the interactive campus maps, custom vehicle markers, and routing polylines.
*   **Expo Location** (`v19.0.8`): Provides highly accurate, real-time GPS coordinate reading from device hardware for driver tracking.
*   **Expo Notifications** (`v0.32.17`): Manages the scheduling and handling of incoming local and remote push notifications (FCM/APNs).
*   **Zustand** (`v4.4.0`): A lightweight, fast state management library used for globally synchronizing the user's wallet balance and ride status across screens.
*   **Axios** (`v1.6.0`): A promise-based HTTP client used for transmitting secure requests to the Django REST API.

## 2. Backend Development (Application Logic & Financial Engine)

The backend is a monolithic architecture handling complex business logic, database transactions, and real-time networking.

*   **Django** (`v5.0.14`): The foundational high-level Python web framework.
*   **Django REST Framework** (`v3.16.1`): An advanced toolkit used to construct the comprehensive JSON-based Web APIs consumed by the mobile apps.
*   **Django Channels** (`v4.0.0`): Extends Django's synchronous capabilities to handle asynchronous protocols like WebSockets.
*   **Daphne** (`v4.0.0`): An ASGI (Asynchronous Server Gateway Interface) server utilized to route both HTTP and WebSocket traffic.
*   **Gunicorn** (`v21.2.0`): A Python WSGI HTTP Server utilized in production for robust synchronous API serving.
*   **Simple JWT** (`v5.5.1`): (`djangorestframework_simplejwt`) Provides JSON Web Token authentication, entirely replacing vulnerable session-based authentication.
*   **Celery** (`v5.6.2`): An asynchronous task queue/job queue based on distributed message passing, used for handling background tasks like scheduled rides or sending batch emails.

## 3. Databases & Messaging Brokers

*   **PostgreSQL** (via `psycopg2-binary v2.9.11`): The primary Relational Database Management System (RDBMS). Selected specifically over NoSQL alternatives to guarantee strict ACID compliance for digital wallet transactions via `transaction.atomic()`.
*   **Redis** (`v5.3.1` and `channels-redis v4.1.0`): An in-memory data structure store used as the critical message broker and channel layer backing for Django Channels to rapidly route WebSocket GPS broadcasts.

## 4. Cloud Services & Third-Party APIs

*   **Paystack API**: Processed via secure webhook endpoints with HMAC SHA-512 verification to securely fund student digital wallets using Nigerian bank accounts/cards.
*   **Flutterwave API**: Alternative integrated payment gateway to provide system redundancy for wallet top-ups.
*   **Google Maps & Directions API**: Utilized for distance calculation and Estimated Time of Arrival (ETA) generation.
*   **Firebase Cloud Messaging (FCM)**: The underlying infrastructure used to deliver background push notifications to Android devices (abstracted via the Expo Push API).
*   **SendGrid API** (via `sendgrid v6.11.0`): Utilized for transactional email delivery (e.g., password resets, welcome emails, and digital wallet receipts).

## 5. Development Tools & Utilities

*   **TypeScript**: Applied across the React Native frontend to provide strict static typing, minimizing runtime errors.
*   **Python 3**: The core programming language of the backend environment.
*   **Docker**: Utilized to containerize the Django API, Redis, and PostgreSQL instances for identical development and production environments.
*   **Visual Studio Code**: Primary Integrated Development Environment (IDE).
*   **Postman**: Used for exhaustive testing of REST API endpoints and inspecting WebSocket payloads.
*   **Git & GitHub**: Version control and source code repository management.
