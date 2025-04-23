# ✈️ CloudCompass - Aviation Weather Dashboard

![Project Preview](https://img.shields.io/badge/Status-Active-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-orange)

A modern, real-time aviation weather dashboard that provides comprehensive weather information for pilots and aviation enthusiasts. CloudCompass combines multiple weather data sources to create a unified, easy-to-understand interface for flight planning and weather monitoring.

## 🌟 Features

- **Real-time METAR Reports**: Get current weather conditions at airports
- **TAF Forecasts**: View terminal aerodrome forecasts
- **PIREP Integration**: Access pilot weather reports
- **SIGMET Alerts**: Stay informed about significant weather phenomena
- **Interactive Map**: Visualize flight paths and weather conditions
- **Route Summary**: Get comprehensive weather overviews for your flight plan
- **Responsive Design**: Works seamlessly on all devices

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js
- **APIs**: 
  - Aviation Weather API
  - Google Maps API
  - Groq API (for weather interpretation)

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Google Maps API key
- Groq API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/chxmq/cloudcompass.git
cd cloudcompass
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GROQ_API_KEY=your_groq_api_key
```

4. Start the server:
```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## 📝 Usage

1. Enter your flight plan in the format: `KPHX,1500,KBXK,12000,KPSP,20000,KLAX,50`
   - Airport codes must be 3-4 uppercase letters
   - Altitudes must be in feet (0-60000)

2. Click "Get Weather" to fetch weather data

3. View comprehensive weather information:
   - METAR reports
   - TAF forecasts
   - PIREP reports
   - SIGMET alerts
   - Interactive map
   - Route summary

## 🎨 Design

- Modern, clean interface
- Responsive layout
- Color-coded weather conditions
- Interactive weather cards
- Smooth animations and transitions
- Dark/light mode support

## 🔍 Weather Conditions

- **VFR (Green)**: Visual Flight Rules conditions
- **Significant Weather (Orange)**: Marginal VFR or IFR conditions
- **Severe Weather (Red)**: Hazardous weather conditions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Aviation Weather API for providing weather data
- Google Maps for mapping functionality
- Groq for AI-powered weather interpretation
- All contributors and users of the project

## 📞 Support

For support, please open an issue in the GitHub repository or contact the maintainers.

---

<div align="center">
  <p>Made with ❤️ by the CloudCompass Team</p>
  <p>✈️ Fly Safe! ✈️</p>
</div> 