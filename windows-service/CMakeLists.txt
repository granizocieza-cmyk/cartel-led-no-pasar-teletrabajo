# =============================================================================
#  cartel-agent — CMake (sirve con MSVC o con MinGW)
# =============================================================================
#  Dos piezas:
#    * "nucleo"       : lógica pura (estado.cpp, config.cpp). Compila en cualquier
#                       sistema y se prueba con test_nucleo.
#    * "cartel-agent" : el programa de Windows (WASAPI + WinHTTP + main).
# =============================================================================
cmake_minimum_required(VERSION 3.16)
project(cartel_agent CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(nucleo STATIC src/estado.cpp src/config.cpp)

# Pruebas (funcionan también fuera de Windows): ctest --output-on-failure
enable_testing()
add_executable(test_nucleo tests/test_nucleo.cpp)
target_link_libraries(test_nucleo nucleo)
add_test(NAME nucleo COMMAND test_nucleo)

if(WIN32)
  # WIN32 = subsistema "windows": el .exe NO abre ventana de consola.
  add_executable(cartel-agent WIN32
    src/main.cpp src/mic_wasapi.cpp src/http_winhttp.cpp)
  target_link_libraries(cartel-agent nucleo ole32 oleaut32 uuid winhttp shell32)
  target_compile_definitions(cartel-agent PRIVATE UNICODE _UNICODE _WIN32_WINNT=0x0A00)

  if(MSVC)
    target_compile_options(cartel-agent PRIVATE /W4 /utf-8)
    target_compile_options(nucleo PRIVATE /W4 /utf-8)
  else()
    target_compile_options(cartel-agent PRIVATE -Wall -Wextra)
    # Enlazo la librería de C++ dentro del .exe: así funciona en otro PC sin
    # tener que copiar las DLL de MinGW.
    target_link_options(cartel-agent PRIVATE -static -static-libgcc -static-libstdc++)
  endif()

  # Deja junto al .exe una copia de la configuración de ejemplo.
  add_custom_command(TARGET cartel-agent POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
            ${CMAKE_SOURCE_DIR}/config.example.ini $<TARGET_FILE_DIR:cartel-agent>/config.example.ini)
endif()
