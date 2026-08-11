# NHMS Portal Backend

Backend services for the **New Home Mystery Shops (NHMS) Portal**. This application provides the API, business logic, automation, evaluation processing, AI analysis, file handling, and reporting services that support the NHMS mystery-shopping workflow.

## Overview

The NHMS Portal Backend is a Node.js/Express application designed to connect the NHMS portal with external services and manage the processing of mystery-shopping data.

The backend handles the workflow from **shop and order data through evaluation, scoring, AI analysis, reporting, and document generation**.

### Core capabilities

* Evaluation and scoring processing
* Sales representative performance analysis
* AI-powered evaluation insights
* NocoBase integration
* Dropbox file integration and synchronization
* Video/file upload processing
* Automated Dropbox synchronization
* PDF report generation
* Performance reports and summaries
* Chart and data visualization generation
* Order and shop data processing
* Logging and application utilities

---

## Architecture

The backend is organized into several functional layers:

```text
NHMS Portal
     │
     ▼
Node.js / Express API
     │
     ├── Controllers
     │     ├── Evaluation
     │     └── Upload
     │
     ├── Routes
     │     ├── Evaluation API
     │     └── Upload API
     │
     ├── Services
     │     ├── NocoBase
     │     ├── Dropbox
     │     ├── Evaluation
     │     ├── AI Analysis
     │     ├── Scoring
     │     ├── Orders
     │     └── PDF Reports
     │
     ├── Scheduled Jobs
     │     └── Dropbox Synchronization
     │
     └── Reporting
           ├── Charts
           ├── Evaluation Reports
           └── Performance Reports
```

---

## Main Components

### Evaluation Processing

The evaluation system processes mystery-shop evaluations and provides the business logic required to calculate and organize evaluation results.

It supports:

* Evaluation submission
* Evaluation scoring
* Section-level results
* Evaluation summaries
* Strengths and weaknesses
* Recommendations
* Sales representative performance analysis

---

### AI Evaluation Analysis

The backend integrates AI services to provide additional analysis of evaluation data.

AI services are used for generating insights such as:

* Evaluation summaries
* Strengths
* Weaknesses
* Recommendations
* Sales representative performance analysis
* Shop summaries
* Evaluation classifications

The application separates the scoring/business logic from AI-generated insights so that AI analysis can supplement the evaluation rather than replace the underlying scoring process.

---

### NocoBase Integration

The backend communicates with the NHMS NocoBase application to retrieve and process portal data.

The NocoBase service provides the integration layer for working with NHMS data such as:

* Orders
* Shops
* Customers
* Evaluations
* Sales representatives
* Related portal records

Configuration is provided through environment variables.

---

### Dropbox Integration

Dropbox services handle file-related operations and synchronization between Dropbox and the NHMS backend.

The system includes services for:

* Dropbox API communication
* File uploads
* File synchronization
* Upload processing
* Dropbox synchronization jobs

A scheduled synchronization process is also included to detect and process Dropbox changes automatically.

---

### File and Video Uploads

The upload system provides API endpoints and services for handling uploaded files associated with NHMS workflows.

Upload functionality is separated into controllers, routes, and services so that file processing can be maintained independently from other application logic.

---

### PDF Reporting

The backend generates PDF documents from NHMS evaluation and performance data.

PDF functionality includes:

* Evaluation reports
* Performance reports
* Report summaries
* Charts
* Custom HTML/CSS report templates
* PDF upload/storage services

Report templates are maintained separately from the application logic to make report presentation easier to modify.

---

### Performance Reporting

The performance reporting system processes sales representative performance information and generates reports that can include:

* Performance metrics
* Evaluation results
* Summary information
* Charts
* Performance analysis
* PDF reports

---

## Project Structure

```text
NHMS-project/
│
├── config/
│   └── External service configuration
│
├── constants/
│   └── Application constants and benchmarks
│
├── controllers/
│   ├── evaluation.controller.js
│   └── upload.controller.js
│
├── cron/
│   └── dropbox.sync.cron.js
│
├── routes/
│   ├── evaluation.routes.js
│   └── upload.routes.js
│
├── services/
│   ├── chart.service.js
│   ├── classification.engine.js
│   ├── dropbox.service.js
│   ├── dropbox.sync.service.js
│   ├── evaluation.service.js
│   ├── nocobase.service.js
│   ├── order.service.js
│   ├── scoring.engine.js
│   ├── pdf.service.js
│   └── ...
│
├── templates/
│   ├── report templates
│   ├── performance templates
│   └── chart/report assets
│
├── utils/
│   ├── format.js
│   ├── helpers.js
│   └── logger.js
│
├── index.js
├── package.json
├── package-lock.json
├── pm2.config.js
├── .env.example
└── .gitignore
```

---

## Environment Configuration

The application uses environment variables for server configuration and external service credentials.

Create a local `.env` file based on `.env.example`.

```env
PORT=
BASE_URL=

NOCOBASE_URL=
NOCOBASE_TOKEN=

DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REFRESH_TOKEN=

LOG_LEVEL=debug
TIMEOUT_MS=

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

### Security

**Never commit the real `.env` file or API credentials to GitHub.**

The repository contains `.env.example` as a safe configuration template. Actual credentials should remain in the deployment environment.

---

## Installation

Clone the repository:

```bash
git clone https://github.com/wessen123/NHMS-project.git
cd NHMS-project
```

Install dependencies:

```bash
npm install
```

Create the environment configuration:

```bash
cp .env.example .env
```

Edit `.env` and provide the required deployment credentials and configuration.

---

## Running the Application

For development:

```bash
npm start
```

The exact available npm commands are defined in `package.json`.

For production deployment, the project includes a PM2 configuration:

```bash
pm2 start pm2.config.js
```

---

## External Services

The backend integrates with several external systems:

* **NocoBase** — portal data and application backend
* **Dropbox** — file storage and synchronization
* **OpenAI** — AI-powered evaluation analysis
* **Node.js / Express** — API and application server
* **PM2** — production process management

---

## API Responsibilities

The API layer is organized around application responsibilities rather than placing all functionality in a single server file.

### Evaluation API

Handles evaluation-related requests and delegates processing to the evaluation services.

### Upload API

Handles file/upload-related requests and delegates processing to the upload services.

This separation keeps controllers and routes lightweight while allowing the underlying business logic to remain reusable.

---

## Automated Processing

The backend includes scheduled processing for Dropbox synchronization.

The synchronization workflow is designed to:

1. Check Dropbox for relevant changes.
2. Process detected files.
3. Synchronize file information with the NHMS backend.
4. Continue processing without requiring manual intervention.

---

## Reporting Workflow

The reporting pipeline generally follows this pattern:

```text
NHMS Evaluation
       │
       ▼
Evaluation Processing
       │
       ├── Scoring
       │
       ├── Classification
       │
       └── AI Analysis
              │
              ▼
        Report Data
              │
              ▼
       Charts / Templates
              │
              ▼
          PDF Report
```

---

## Development Principles

The project separates major responsibilities into independent services and layers.

This provides:

* Easier maintenance
* Reusable business logic
* Clear separation between API and services
* Easier testing and debugging
* Better integration with external services
* More manageable future development

---

## Deployment

The backend is designed to run as a Node.js service on a Linux server.

Production deployment can use:

* Node.js
* PM2
* Environment variables
* Reverse proxy configuration
* External storage services

Production credentials should always be supplied through the deployment environment rather than committed to source control.

---

## Repository

**NHMS Project:**
https://github.com/wessen123/NHMS-project

---

## Project Status

The NHMS backend is under active development. Features and integrations may continue to evolve as the NHMS Portal workflow is expanded.

## License

Private project for NHMS application development.
