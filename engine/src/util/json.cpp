#include "util/json.h"

#include <sstream>

std::string jsonNumber(double value) {
    std::ostringstream os;
    if (value == static_cast<long long>(value)) {
        os << static_cast<long long>(value);
    } else {
        os.precision(3);
        os << std::fixed << value;
    }
    return os.str();
}

std::string jsonString(const std::string& text) {
    return "\"" + text + "\"";
}

std::string jsonIntArray(const std::vector<int>& values) {
    std::string out = "[";
    for (size_t i = 0; i < values.size(); i++) {
        if (i) out += ",";
        out += std::to_string(values[i]);
    }
    return out + "]";
}

std::string jsonMatrix(const std::vector<std::vector<int>>& rows) {
    std::string out = "[";
    for (size_t i = 0; i < rows.size(); i++) {
        if (i) out += ",";
        out += jsonIntArray(rows[i]);
    }
    return out + "]";
}
