# Smart Factory Production Scheduler - Makefile
# Run 'make all' or just 'make' to build and run everything

.PHONY: all clean backend frontend install run help

# Default target
all: backend install run

# Compile C++ backend
backend:
	@echo "Compiling C++ backend..."
	@g++ -std=c++17 -Ibackend/include \
		backend/src/main.cpp \
		backend/src/scheduler.cpp \
		backend/src/resource_manager.cpp \
		backend/src/bankers.cpp \
		-o scheduler
	@echo "✓ Backend compiled successfully"

# Install frontend dependencies
install:
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install
	@echo "✓ Frontend dependencies installed"

# Run the complete system
run:
	@echo "Running C++ scheduler..."
	@echo "-----------------------------------"
	@./scheduler
	@echo "-----------------------------------"
	@echo ""
	@echo "Starting React dashboard..."
	@echo "The dashboard will open in your browser."
	@echo "Press Ctrl+C to stop the server."
	@echo "-----------------------------------"
	@cd frontend && npm run dev

# Run only the backend
run-backend: backend
	@./scheduler

# Run only the frontend
run-frontend:
	@cd frontend && npm run dev

# Clean compiled files
clean:
	@echo "Cleaning compiled files..."
	@rm -f scheduler scheduler.exe
	@echo "✓ Clean complete"

# Show help
help:
	@echo "Smart Factory Production Scheduler - Build Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  make all          - Build backend, install frontend deps, and run everything (default)"
	@echo "  make backend      - Compile C++ backend only"
	@echo "  make install      - Install frontend npm packages"
	@echo "  make run          - Run scheduler then start frontend server"
	@echo "  make run-backend  - Compile and run only the C++ scheduler"
	@echo "  make run-frontend - Run only the React dashboard"
	@echo "  make clean        - Remove compiled binaries"
	@echo "  make help         - Show this help message"
