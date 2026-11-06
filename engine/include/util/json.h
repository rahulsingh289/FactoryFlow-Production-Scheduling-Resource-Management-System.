#ifndef FACTORY_UTIL_JSON_H
#define FACTORY_UTIL_JSON_H

#include <string>
#include <vector>

// Tiny helpers for writing the JSON the backend reads. The engine only ever writes
// numbers, fixed words and lists of numbers, so no escaping is needed.
std::string jsonNumber(double value);                                  // 3 -> "3", 2.5 -> "2.500"
std::string jsonString(const std::string& text);                       // wraps in quotes
std::string jsonIntArray(const std::vector<int>& values);              // [1,2,3]
std::string jsonMatrix(const std::vector<std::vector<int>>& rows);     // [[1,2],[3,4]]

#endif
