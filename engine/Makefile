# Builds the C++ engine.
#   make            build ./factory_engine
#   make clean      remove the build
#
# Every .cpp file under src/ is found automatically, in any folder, so a new file
# (for example a new scheduling policy) needs no change here.
#
# Without make:  g++ -std=c++17 -O2 -Iinclude $(find src -name '*.cpp') -o factory_engine

CXX      ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Wpedantic
INCLUDES := -Iinclude
TARGET   := factory_engine
BUILD    := build

# All files matching $(2) in folder $(1) and every folder below it.
rwildcard = $(foreach d,$(wildcard $(1)*),$(call rwildcard,$(d)/,$(2)) $(filter $(subst *,%,$(2)),$(d)))

SOURCES := $(call rwildcard,src/,*.cpp)
OBJECTS := $(patsubst src/%.cpp,$(BUILD)/%.o,$(SOURCES))
DEPENDS := $(OBJECTS:.o=.d)

$(TARGET): $(OBJECTS)
	$(CXX) $(CXXFLAGS) $(OBJECTS) -o $@

$(BUILD)/%.o: src/%.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -MMD -MP -c $< -o $@

clean:
	rm -rf $(BUILD) $(TARGET)

-include $(DEPENDS)

.PHONY: clean
