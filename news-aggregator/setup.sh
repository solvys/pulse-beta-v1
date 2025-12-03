#!/bin/bash

# Quick setup script for news aggregator
# Usage: ./setup.sh

set -e

echo "=================================="
echo "📰 News Aggregator Setup"
echo "=================================="
echo ""

# Check Python version
echo "🐍 Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "   Python version: $python_version"
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "🔨 Creating virtual environment..."
    python3 -m venv venv
    echo "   ✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi
echo ""

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate
echo "   ✅ Virtual environment activated"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt
echo "   ✅ Dependencies installed"
echo ""

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo "   ✅ .env file created"
    echo "   ⚠️  Please edit .env and add your API keys!"
else
    echo "✅ .env file already exists"
fi
echo ""

# Test configuration
echo "🧪 Testing configuration..."
python src/config.py
echo ""

echo "=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Edit .env and add your API keys:"
echo "   - ALPACA_API_KEY (get from https://app.alpaca.markets)"
echo "   - FINNHUB_API_KEY (get from https://finnhub.io/dashboard)"
echo ""
echo "2. Test the system:"
echo "   python src/main.py --test"
echo ""
echo "3. Run continuously:"
echo "   python src/main.py"
echo ""
echo "For help:"
echo "   python src/main.py --help"
echo ""
