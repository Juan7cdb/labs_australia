# Australia Lab Visualization Map

## Overview
This project is a static web application designed to visualize the distribution of laboratory facilities across Australia. It transforms raw data into an interactive geospatial experience using **Mapbox GL JS**, rendering over 6,500 data points with efficiency and style.

The application serves as a Proof of Concept (PoC) for visualizing large datasets (CSV/JSON) on varied map interfaces.

## Key Features
-   **Interactive Map**: Powered by Mapbox GL JS for smooth, high-performance vector rendering.
-   **Data Clustering**: Intelligent grouping of points at lower zoom levels to improve readability and performance.
-   **Secure Access**: A clean, full-screen login overlay to restrict access.
-   **Detail View**: Interactive info cards (Google Maps style) that allow users to inspect specific details (Name, Suburb, Dates) for each laboratory.
-   **Data Stats**: Real-time counter showing the total number of records loaded to verify data integrity.

## Prerequisites
-   A modern web browser (Chrome, Firefox, Edge, Safari).
-   No build process required (Static HTML/JS).

## Usage
1.  Open `index.html` in your browser.
2.  **Login Credentials**:
    -   **Email**: `juan.mora@tbtbglobal.com`
    -   **Password**: `1234567890`
3.  Navigate the map and click on blue markers to view details.

## Technologies
-   **Frontend**: HTML5, CSS3 (Modern Variables & Flexbox), Vanilla JavaScript (ES6+).
-   **Mapping Engine**: Mapbox GL JS v2.15.
-   **Data Format**: GeoJSON (processed from standard JSON).

## Project Structure
```bash
web_dist/
├── index.html                  # Entry point
├── style.css                   # Styles and Animations
├── app.js                      # Application Logic & Map Config
└── labs_with_coordinates.json  # Data Source
```

---
*Developed for TBTB Global / Visualization Demo*
