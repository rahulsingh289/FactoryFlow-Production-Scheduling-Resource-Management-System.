#!/bin/bash

# Test script to verify frontend builds correctly

echo "Testing frontend build..."
cd /Users/rahulsingh/Downloads/Smart_Factory_Production_Scheduler_50pct/frontend

# Try to build (this will catch any React errors)
npm run build

if [ $? -eq 0 ]; then
    echo "✓ Frontend build successful! All components are working."
    echo ""
    echo "You can now run the app with:"
    echo "  ./run.sh"
else
    echo "✗ Frontend build failed. Check the errors above."
    exit 1
fi
