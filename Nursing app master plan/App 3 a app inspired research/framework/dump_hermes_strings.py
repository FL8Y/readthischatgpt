import sys, json
from hermes_dec.parsers import hbc_file_parser as p
r = p.HBCReader()
f = open(sys.argv[1], 'rb')
# read only up to strings
r.file_buffer = f
r.read_header_from_buffer()
r.read_functions(); r.read_string_kinds(); r.read_identifier_hashes()
r.read_small_string_table(); r.read_overflow_string_table(); r.read_string_storage()
open(sys.argv[2], 'w', encoding='utf-8', errors='replace').write("\n".join(s.replace("\n","\\n") for s in r.strings))
print(len(r.strings))
